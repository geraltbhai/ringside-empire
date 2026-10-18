"use client";

import { useGame } from "@/store/game";
import { cn } from "@/lib/cn";

export function Toaster() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto animate-spotlight rounded-md border px-4 py-2 text-sm font-semibold shadow-xl",
            t.tone === "good" && "border-good/40 bg-[#0f2118] text-good",
            t.tone === "bad" && "border-bad/40 bg-[#2a0f16] text-bad",
            t.tone === "neutral" && "border-rope bg-canvas text-ink",
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
