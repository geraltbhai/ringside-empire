"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-4xl">Something broke backstage</h1>
        <p className="mt-2 text-muted">This screen hit an error. Your autosave is untouched. Try again, or export a backup from Settings first.</p>
        <p className="mt-3 rounded bg-canvas px-3 py-2 text-left font-mono text-xs text-muted">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="gold-plate rounded-md px-4 py-2 text-sm font-semibold">
            Try again
          </button>
          <Link href="/settings" className="rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-rope hover:ring-muted">
            Export my save
          </Link>
          <Link href="/" className="rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-rope hover:ring-muted">
            Main menu
          </Link>
        </div>
      </div>
    </main>
  );
}
