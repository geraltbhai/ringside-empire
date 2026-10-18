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
let toastId = 1;

export const useGame = create<GameState>((set, get) => {
  const persist = async () => {
    const { universe, slot } = get();
    if (!universe || !slot) return;
    set({ saveState: "saving" });
    try {
      await db.saveToSlot(slot, universe);
      set({ saveState: "saved" });
      get().refreshSlots();
    } catch (e) {
      console.error(e);
      set({ saveState: "error", error: "Autosave failed — export your save to be safe." });
    }
  };
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveState: "saving" });
    saveTimer = setTimeout(persist, 300);
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
          const universe = await db.loadSlot(active);
          if (universe) {
            set({ status: "ready", universe, slot: active, slots });
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
