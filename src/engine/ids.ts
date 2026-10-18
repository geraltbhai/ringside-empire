import type { Universe } from "./types";

/** Deterministic id generator stored in the save, so replays produce identical ids. */
export function nextId(universe: Universe, prefix: string) {
  const id = `${prefix}-${universe.counters.nextId.toString(36)}`;
  universe.counters.nextId += 1;
  return id;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
