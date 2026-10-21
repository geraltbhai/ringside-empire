"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Field, inputClass, Panel } from "@/components/ui/primitives";
import { BRANDS, ROSTER_WRESTLERS } from "@/data/seed";
import type { Settings } from "@/engine/types";
import { cn, money } from "@/lib/cn";
import { useGame } from "@/store/game";

const DIFFICULTIES: { value: Settings["difficulty"]; label: string; text: string }[] = [
  { value: "easy", label: "Easy", text: "1.5× starting cash, forgiving AI opponents." },
  { value: "normal", label: "Normal", text: "The intended balance." },
  { value: "hard", label: "Hard", text: "0.6× starting cash, sharp AI reversals." },
];

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  // Local calendar date (toISOString would shift it by the UTC offset).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewUniversePage() {
  const router = useRouter();
  const newUniverse = useGame((s) => s.newUniverse);
  const [name, setName] = useState("Universe 1");
  const [promotion, setPromotion] = useState("Apex Wrestling Alliance");
  const [startDate, setStartDate] = useState(nextMonday);
  const [difficulty, setDifficulty] = useState<Settings["difficulty"]>("normal");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c = { mayhem: 0, fury: 0, legends: 0, "free-agents": 0 };
    for (const w of ROSTER_WRESTLERS) c[w.brand]++;
    return c;
  }, []);
  const cash = 5_000_000 * { easy: 1.5, normal: 1, hard: 0.6 }[difficulty];
  const valid = name.trim() && promotion.trim() && /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Main menu
      </Link>
      <h1 className="font-display mt-4 text-5xl sm:text-6xl">New universe</h1>
      <p className="mt-2 max-w-xl text-muted">You run the promotion: two weekly brands, a premium live event every fourth Sunday, and {ROSTER_WRESTLERS.length} wrestlers to build into stars.</p>

      <form
        className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          await newUniverse({ name: name.trim(), promotionName: promotion.trim(), startDate, startingCash: 5_000_000, difficulty });
          router.push("/dashboard");
        }}
      >
        <Panel>
          <div className="space-y-4">
            <Field label="Promotion name">
              <input className={inputClass} value={promotion} onChange={(e) => setPromotion(e.target.value)} maxLength={48} required />
            </Field>
            <Field label="Save name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </Field>
            <Field label="First show date" hint="Monday Night Raw (WWE) airs on this day each week; AEW Dynamite four days later.">
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm text-muted">Difficulty</legend>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    aria-pressed={difficulty === d.value}
                    className={cn("rounded-md border p-3 text-left", difficulty === d.value ? "border-gold bg-gold/10" : "border-rope hover:border-muted")}
                  >
                    <div className="font-semibold">{d.label}</div>
                    <div className="mt-1 text-xs text-muted">{d.text}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="What you start with">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Cash</dt>
                <dd className="font-cond text-lg font-semibold">{money(cash)}</dd>
              </div>
              {(["mayhem", "fury", "legends", "free-agents"] as const).map((b) => (
                <div key={b} className="flex items-center justify-between">
                  <dt className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: BRANDS[b].color }} />
                    {BRANDS[b].showName}
                  </dt>
                  <dd className="text-muted">{counts[b]} wrestlers</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-muted">Championships</dt>
                <dd>9 titles</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Active rivalries</dt>
                <dd>7</dd>
              </div>
            </dl>
          </Panel>
          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={!valid || busy}>
            {busy ? "Building universe…" : "Start universe"}
          </Button>
        </div>
      </form>
    </div>
  );
}
