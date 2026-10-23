"use client";

import { Portrait } from "@/components/Portrait";
import type { DialogueLine, Universe } from "@/engine/types";

/** A promo script: speaker lines with portraits, stage directions in italics. */
export function DialogueView({ u, lines }: { u: Universe; lines: DialogueLine[] }) {
  return (
    <ol className="space-y-2 text-sm">
      {lines.map((l, i) =>
        l.speakerId ? (
          <li key={i} className="flex gap-2">
            <Portrait w={u.wrestlers[l.speakerId]} className="w-8 shrink-0" rounded="rounded" />
            <div>
              <div className="text-xs font-semibold text-gold">{u.wrestlers[l.speakerId]?.ringName}</div>
              <div>&ldquo;{l.text}&rdquo;</div>
            </div>
          </li>
        ) : (
          <li key={i} className="italic text-muted">
            {l.text}
          </li>
        ),
      )}
    </ol>
  );
}
