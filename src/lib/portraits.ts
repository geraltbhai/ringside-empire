"use client";
/**
 * User-provided portraits live in their own IndexedDB store (not in the save),
 * so big images never bloat save files. Bundled portraits are listed in the
 * asset manifest (src/data/assets.ts). Everything falls back to procedural art.
 */
import { createStore, del, get, set, type UseStore } from "idb-keyval";

let store: UseStore | null = null;
const db = () => (store ??= createStore("ringside-empire-portraits", "portraits"));
const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function subscribePortraits(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getCustomPortrait(id: string): Promise<string | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  try {
    const value = ((await get(id, db())) as string | undefined) ?? null;
    cache.set(id, value);
    return value;
  } catch {
    cache.set(id, null);
    return null;
  }
}

export function peekCustomPortrait(id: string) {
  return cache.has(id) ? (cache.get(id) ?? null) : undefined;
}

/** Downscales an uploaded image to 320px wide JPEG before storing it. */
export async function setCustomPortrait(id: string, file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 320 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  await set(id, dataUrl, db());
  cache.set(id, dataUrl);
  listeners.forEach((l) => l());
}

export async function clearCustomPortrait(id: string) {
  await del(id, db());
  cache.set(id, null);
  listeners.forEach((l) => l());
}
