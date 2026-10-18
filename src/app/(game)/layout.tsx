"use client";

import {
  BarChart3,
  Calendar,
  ClipboardList,
  Crown,
  FileSignature,
  Gamepad2,
  History,
  LayoutDashboard,
  Menu,
  Save,
  Settings,
  Swords,
  Tv,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { formatGameDate } from "@/engine/calendar";
import { cn, money } from "@/lib/cn";
import { useGame } from "@/store/game";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/booking", label: "Booking", icon: ClipboardList },
  { href: "/match", label: "Play match", icon: Gamepad2 },
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/rivalries", label: "Rivalries", icon: Swords },
  { href: "/championships", label: "Championships", icon: Crown },
  { href: "/brands", label: "Brands", icon: Tv },
  { href: "/contracts", label: "Contracts", icon: FileSignature },
  { href: "/finances", label: "Finances", icon: BarChart3 },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/history", label: "Match history", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function GameLayout({ children }: { children: ReactNode }) {
  const status = useGame((s) => s.status);
  const universe = useGame((s) => s.universe);
  const saveState = useGame((s) => s.saveState);
  const boot = useGame((s) => s.boot);
  const saveNow = useGame((s) => s.saveNow);
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    boot();
  }, [boot]);
  useEffect(() => {
    if (status === "empty") router.replace("/");
  }, [status, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-display text-3xl">Saves unavailable</p>
          <p className="mt-2 text-muted">Your browser blocked local storage (IndexedDB). Leave private browsing mode or allow site data, then reload.</p>
        </div>
      </div>
    );
  }
  if (!universe) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="font-display animate-pulse text-2xl text-muted">Loading universe…</p>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Game">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-ink text-arena" : "text-muted hover:bg-canvas-2 hover:text-ink",
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-rope bg-arena/80 p-4 lg:flex">
        <Link href="/" className="block px-2">
          <div className="font-display text-2xl leading-none">Ringside</div>
          <div className="font-display gold-text text-2xl leading-none">Empire</div>
          <div className="mt-1 truncate text-xs text-muted">{universe.promotionName}</div>
        </Link>
        <div className="scrollbar-thin -mx-1 flex-1 overflow-y-auto px-1">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 overflow-y-auto border-r border-rope bg-arena p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-xl">{universe.promotionName}</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rope bg-arena/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              Week {universe.week + 1} · {formatGameDate(universe.startDate, universe.week)}
            </div>
          </div>
          <div className={cn("font-cond text-lg font-semibold tabular-nums", universe.cash < 0 ? "text-bad" : "text-ink")} title="Cash balance">
            {money(universe.cash)}
          </div>
          <button
            onClick={saveNow}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted ring-1 ring-rope hover:text-ink"
            title="Save now (the game also autosaves)"
          >
            <Save size={14} />
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
