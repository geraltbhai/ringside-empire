const ARROWS: Record<string, string> = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };

/** Human-readable label for a KeyboardEvent.key value (lower-cased). */
export function keyLabel(k: string) {
  if (k === " ") return "Space";
  if (k === "escape") return "Esc";
  if (ARROWS[k]) return ARROWS[k];
  return k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1);
}
