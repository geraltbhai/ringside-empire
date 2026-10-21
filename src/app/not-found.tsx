import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-display text-8xl text-muted">404</p>
        <h1 className="font-display mt-2 text-4xl">Wrong arena</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">There&apos;s no page at this address. Your universe is safe — it lives in this browser.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/dashboard" className="gold-plate rounded-md px-4 py-2 text-sm font-semibold">
            Go to the dashboard
          </Link>
          <Link href="/" className="rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-rope hover:ring-muted">
            Main menu
          </Link>
        </div>
      </div>
    </main>
  );
}
