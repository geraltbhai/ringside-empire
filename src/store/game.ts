"use client";

import { create } from "zustand";
import type { NewUniverseOptions } from "@/data/seed";
import { parseUniverse, serializeUniverse } from "@/engine/schema";
import type { SaveSlotMeta, Universe } from "@/engine/types";
import { startUniverse } from "@/engine/universe";
import * as db from "@/lib/persistence";

type Status = "booting" | "empty" | "ready" | "error";
type SaveState = "saved" | "saving" | "error";

export interface Toast {
  id: number;
  text: string;
  tone: "good" | "bad" | "neutral";
}

interface GameState {
  status: Status;
  universe: Universe | null;
  slot: string | null;
  slots: SaveSlotMeta[];
  saveState: SaveState;
  error: string | null;
  toasts: Toast[];
  boot: () => Promise<void>;
  refreshSlots: () => Promise<void>;
  newUniverse: (options: NewUniverseOptions) => Promise<void>;
  load: (slot: string) => Promise<void>;
  saveNow: () => Promise<void>;
  saveAs: () => Promise<string | null>;
  deleteSlot: (slot: string) => Promise<void>;
  /** Applies a mutation to a clone of the universe, commits it and autosaves. Returns the mutator's value. */
  mutate: <T>(fn: (u: Universe) => T) => T;
  exportSave: () => string | null;
  importSave: (json: string) => Promise<void>;
  resetUniverse: () => Promise<void>;
  closeUniverse: () => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const PENDING_KEY = "ringside:pending-save";
let toastId = 1;

export const useGame = create<GameState>((set, get) => {
  let inflight = 0;
  let lastWrite = 0;
  /** Universe revision that IndexedDB is known to hold. */
  let writtenRev = "";
  const persist = async () => {
    const { universe, slot } = get();
    if (!universe || !slot) return;
    set({ saveState: "saving" });
    inflight++;
    lastWrite = Date.now();
    try {
      await db.saveToSlot(slot, universe);
      writtenRev = universe.updatedAt;
      set({ saveState: inflight > 1 || saveTimer ? "saving" : "saved" });
      get().refreshSlots();
    } catch (e) {
      console.error(e);
      set({ saveState: "error", error: "Autosave failed — export your save to be safe." });
    } finally {
      inflight--;
    }
  };
  /** Leading-edge write so a single action is saved straight away; trailing debounce for bursts (sliders). */
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    set({ saveState: "saving" });
    if (Date.now() - lastWrite > 400) {
      void persist();
      return;
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persist();
    }, 250);
  };
  // Never lose the last change when the tab is hidden, closed or reloaded. IndexedDB writes are
  // asynchronous and may not finish during unload, so an unwritten universe is also copied
  // synchronously to localStorage and recovered on the next boot.
  if (typeof window !== "undefined") {
    const flush = () => {
      const { universe, slot } = get();
      if (!universe || !slot) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        void persist();
      }
      if (inflight > 0 || writtenRev !== universe.updatedAt) {
        try {
          localStorage.setItem(PENDING_KEY, JSON.stringify({ slot, at: universe.updatedAt, json: serializeUniverse(universe) }));
        } catch {
          /* quota or private mode: IndexedDB write is still in progress */
        }
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }

  /** Returns a universe newer than the IndexedDB copy if one was saved during the last unload. */
  const recoverPending = (slot: string, stored: Universe | null): Universe | null => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      localStorage.removeItem(PENDING_KEY);
      const pending = JSON.parse(raw) as { slot: string; at: string; json: string };
      if (pending.slot !== slot) return null;
      if (stored && stored.updatedAt >= pending.at) return null;
      return parseUniverse(pending.json);
    } catch {
      return null;
    }
  };

  return {
    status: "booting",
    universe: null,
    slot: null,
    slots: [],
    saveState: "saved",
    error: null,
    toasts: [],

    boot: async () => {
      if (get().status === "ready") return;
      try {
        const slots = await db.listSlots();
        const active = await db.activeSlot();
        if (active) {
          const stored = await db.loadSlot(active);
          const recovered = recoverPending(active, stored);
          const universe = recovered ?? stored;
          if (universe) {
            set({ status: "ready", universe, slot: active, slots });
            if (recovered) await persist();
            else writtenRev = universe.updatedAt;
            return;
          }
        }
        set({ status: "empty", slots });
      } catch (e) {
        console.error(e);
        set({ status: "error", error: e instanceof Error ? e.message : "Could not open local saves." });
      }
    },

    refreshSlots: async () => set({ slots: await db.listSlots() }),

    newUniverse: async (options) => {
      const universe = startUniverse(options);
      const slot = db.newSlotId();
      set({ universe, slot, status: "ready" });
      await persist();
    },

    load: async (slot) => {
      const universe = await db.loadSlot(slot);
      if (!universe) throw new Error("That save slot is empty.");
      set({ universe, slot, status: "ready" });
      await persist();
    },

    saveNow: async () => {
      if (saveTimer) clearTimeout(saveTimer);
      await persist();
      get().toast("Game saved", "good");
    },

    saveAs: async () => {
      const { universe } = get();
      if (!universe) return null;
      const slot = db.newSlotId();
      set({ slot });
      await persist();
      get().toast("Saved to a new slot", "good");
      return slot;
    },

    deleteSlot: async (slot) => {
      await db.deleteSlot(slot);
      if (get().slot === slot) set({ universe: null, slot: null, status: "empty" });
      await get().refreshSlots();
    },

    mutate: (fn) => {
      const current = get().universe;
      if (!current) throw new Error("No universe loaded");
      const draft = structuredClone(current);
      const value = fn(draft);
      draft.updatedAt = new Date().toISOString();
      set({ universe: draft });
      scheduleSave();
      return value;
    },

    exportSave: () => {
      const u = get().universe;
      return u ? serializeUniverse(u) : null;
    },

    importSave: async (json) => {
      const universe = parseUniverse(json);
      const slot = db.newSlotId();
      set({ universe, slot, status: "ready" });
      await persist();
    },

    resetUniverse: async () => {
      const u = get().universe;
      if (!u) return;
      const fresh = startUniverse({ name: u.name, promotionName: u.promotionName, startDate: u.startDate, startingCash: 5_000_000, difficulty: u.settings.difficulty });
      set({ universe: fresh });
      await persist();
      get().toast("Universe reset to week 1", "neutral");
    },

    closeUniverse: () => set({ universe: null, slot: null, status: "empty" }),

    toast: (text, tone = "neutral") => {
      const id = toastId++;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
      setTimeout(() => get().dismissToast(id), 4200);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});

/** Convenience hook: the loaded universe (components below the shell can rely on it). */
export function useUniverse(): Universe {
  const u = useGame((s) => s.universe);
  if (!u) throw new Error("useUniverse called without a loaded universe");
  return u;
}
