/**
 * Local-first persistence in IndexedDB (via idb-keyval). Each save slot stores
 * the full universe; a small index keeps slot metadata for the Load screen.
 */
import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { parseUniverse, serializeUniverse } from "../engine/schema";
import type { SaveSlotMeta, Universe } from "../engine/types";

const INDEX_KEY = "slots:index";
const ACTIVE_KEY = "slots:active";
let store: UseStore | null = null;

function db(): UseStore {
  if (!store) store = createStore("ringside-empire", "saves");
  return store;
}

export function metaFor(slot: string, u: Universe): SaveSlotMeta {
  return {
    slot,
    universeName: u.name,
    promotionName: u.promotionName,
    week: u.week,
    cash: u.cash,
    updatedAt: u.updatedAt,
    schemaVersion: u.schemaVersion,
  };
}

export async function listSlots(): Promise<SaveSlotMeta[]> {
  const index = ((await get(INDEX_KEY, db())) as SaveSlotMeta[] | undefined) ?? [];
  return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveToSlot(slot: string, universe: Universe) {
  const stamped = { ...universe, updatedAt: new Date().toISOString() };
  // Stored as the same JSON format used for export so loading always goes through validation.
  await set(`slot:${slot}`, serializeUniverse(stamped), db());
  const index = ((await get(INDEX_KEY, db())) as SaveSlotMeta[] | undefined) ?? [];
  const next = index.filter((m) => m.slot !== slot);
  next.push(metaFor(slot, stamped));
  await set(INDEX_KEY, next, db());
  await set(ACTIVE_KEY, slot, db());
  return stamped;
}

export async function loadSlot(slot: string): Promise<Universe | null> {
  const raw = (await get(`slot:${slot}`, db())) as string | undefined;
  if (!raw) return null;
  return parseUniverse(raw);
}

export async function deleteSlot(slot: string) {
  await del(`slot:${slot}`, db());
  const index = ((await get(INDEX_KEY, db())) as SaveSlotMeta[] | undefined) ?? [];
  await set(INDEX_KEY, index.filter((m) => m.slot !== slot), db());
  const active = await get(ACTIVE_KEY, db());
  if (active === slot) await del(ACTIVE_KEY, db());
}

export async function activeSlot(): Promise<string | null> {
  return ((await get(ACTIVE_KEY, db())) as string | undefined) ?? null;
}

export function newSlotId() {
  return `slot-${Date.now().toString(36)}`;
}
