"use client";

import { Download, FolderOpen, Gamepad2, Play, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { money } from "@/lib/cn";
import { useGame } from "@/store/game";

const MenuArena = dynamic(() => import("@/components/match3d/MenuArena"), { ssr: false, loading: () => null });

export default function MainMenu() {
  const { status, universe, slots, boot, load, deleteSlot, importSave, exportSave, toast } = useGame();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showLoad, setShowLoad] = useState(false);

  useEffect(() => {
    boot();
  }, [boot]);

  const download = () => {
    const json = exportSave();
    if (!json || !universe) return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${universe.promotionName.replace(/\W+/g, "-").toLowerCase()}-week-${universe.week + 1}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <MenuArena />
        <div className="absolute inset-0 bg-gradient-to-r from-arena via-arena/85 to-arena/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-arena via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-6 py-12 sm:px-10">
        <div className="animate-spotlight">
          <p className="text-sm font-semibold text-muted">A wrestling universe you run — and fight in</p>
          <h1 className="font-display mt-3 text-[clamp(3.5rem,11vw,9rem)]">
            Ringside
            <br />
            <span className="gold-text">Empire</span>
          </h1>
        </div>

        <div className="mt-10 flex max-w-sm flex-col gap-3">
          {status === "booting" && <p className="text-muted">Opening saves…</p>}
          {universe && (
            <Button variant="gold" size="lg" className="justify-start" onClick={() => router.push("/dashboard")}>
              <Play size={18} /> Continue {universe.promotionName} — week {universe.week + 1}
            </Button>
          )}
          <Link href="/new">
            <Button variant={universe ? "outline" : "gold"} size="lg" className="w-full justify-start">
              <Plus size={18} /> New universe
            </Button>
          </Link>
          {slots.length > 0 && (
            <Button size="lg" className="justify-start" onClick={() => setShowLoad((v) => !v)} aria-expanded={showLoad}>
              <FolderOpen size={18} /> Load game ({slots.length})
            </Button>
          )}
          {universe && (
            <Button size="lg" className="justify-start" onClick={() => router.push("/match")}>
              <Gamepad2 size={18} /> Quick match
            </Button>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Import save
            </Button>
            {universe && (
              <Button size="sm" variant="ghost" onClick={download}>
                <Download size={15} /> Export save
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await importSave(await file.text());
                toast("Save imported", "good");
                router.push("/dashboard");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Import failed", "bad");
              }
              e.target.value = "";
            }}
          />
        </div>

        {showLoad && (
          <div className="mt-6 max-w-xl animate-spotlight rounded-lg border border-rope bg-canvas/95 p-3">
            <ul className="divide-y divide-rope">
              {slots.map((s) => (
                <li key={s.slot} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.promotionName}</div>
                    <div className="text-xs text-muted">
                      {s.universeName} · week {s.week + 1} · {money(s.cash)} · {new Date(s.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      await load(s.slot);
                      router.push("/dashboard");
                    }}
                  >
                    Load
                  </Button>
                  <button
                    className="rounded p-2 text-muted hover:text-bad"
                    aria-label={`Delete save ${s.promotionName}`}
                    onClick={() => window.confirm(`Delete the save "${s.promotionName}" (week ${s.week + 1})? This cannot be undone.`) && deleteSlot(s.slot)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-16 max-w-xl text-xs text-muted">
          An independent fan project. All promotions, brands and wrestlers are fictional; ratings are gameplay estimates. Not affiliated with any real wrestling company.
        </p>
      </div>
    </div>
  );
}
