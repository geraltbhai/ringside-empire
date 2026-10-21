"use client";

import { Crown, Gamepad2, Shuffle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BrandBadge, OverallBadge } from "@/components/game";
import { ControlsGuide, LiveMatch, type MatchConfig } from "@/components/match/LiveMatch";
import { Portrait } from "@/components/Portrait";
import { Button, EmptyState, Field, PageHeader, Panel } from "@/components/ui/primitives";
import { overall, ratingCard } from "@/engine/rating";
import { sideName } from "@/engine/queries";
import type { Universe, Wrestler } from "@/engine/types";
import { cn, heightLabel } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const selectClass = "h-11 w-full rounded-md border border-rope bg-arena px-2 text-sm";
const isSigned = (w: Wrestler) => w.brand === "mayhem" || w.brand === "fury";

function WrestlerSelect({ u, value, onChange, exclude, division, label }: { u: Universe; value: string; onChange: (id: string) => void; exclude?: string; division?: Wrestler["division"]; label: string }) {
  const groups = useMemo(() => {
    const list = Object.values(u.wrestlers)
      .filter((w) => w.id !== exclude && (!division || w.division === division))
      .sort((a, b) => overall(b, u.settings) - overall(a, u.settings));
    return (["mayhem", "fury", "legends", "free-agents"] as const).map((b) => ({ b, list: list.filter((w) => w.brand === b) })).filter((g) => g.list.length);
  }, [u, exclude, division]);
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {groups.map((g) => (
        <optgroup key={g.b} label={u.brands[g.b].showName}>
          {g.list.map((w) => (
            <option key={w.id} value={w.id}>
              {w.ringName}
              {w.versionLabel ? ` (${w.versionLabel})` : ""} — {overall(w, u.settings)}
              {w.injury ? " · injured" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function TaleOfTheTape({ u, w, side }: { u: Universe; w: Wrestler; side: "left" | "right" }) {
  const r = ratingCard(w, u.settings);
  return (
    <div className={cn("flex flex-col gap-3", side === "right" && "items-end text-right")}>
      <Portrait w={w} className="w-40 sm:w-48" />
      <div>
        <div className="font-display text-3xl sm:text-4xl">{w.ringName}</div>
        <div className={cn("mt-1 flex flex-wrap items-center gap-2", side === "right" && "justify-end")}>
          <BrandBadge universe={u} brand={w.brand} />
          <OverallBadge value={r.overall} size="sm" />
        </div>
        <dl className={cn("mt-2 grid grid-cols-[auto_auto] gap-x-3 text-sm", side === "right" && "ml-auto")}>
          <dt className="text-muted">Size</dt>
          <dd>
            {heightLabel(w.heightIn)} · {w.weightLbs} lb
          </dd>
          <dt className="text-muted">Style</dt>
          <dd className="capitalize">{w.style}</dd>
          <dt className="text-muted">Strength / speed</dt>
          <dd>
            {w.attributes.strength} / {w.attributes.speed}
          </dd>
          <dt className="text-muted">Reversals</dt>
          <dd>{w.attributes.reversal}</dd>
          <dt className="text-muted">Finisher</dt>
          <dd className="text-gold-light">{w.finisher}</dd>
        </dl>
      </div>
    </div>
  );
}

function MatchPageInner() {
  const u = useUniverse();
  const params = useSearchParams();
  const router = useRouter();
  const showId = params.get("show");
  const segId = params.get("seg");
  const booked = useMemo(() => {
    if (!showId || !segId) return null;
    const show = u.shows.find((s) => s.id === showId);
    const seg = show?.segments.find((s) => s.id === segId);
    return show && seg ? { show, seg } : null;
  }, [u.shows, showId, segId]);

  const signedStars = useMemo(() => Object.values(u.wrestlers).filter(isSigned).sort((a, b) => b.popularity - a.popularity), [u.wrestlers]);
  const [playerId, setPlayerId] = useState(() => (params.get("p") && u.wrestlers[params.get("p")!] ? params.get("p")! : signedStars[0]?.id ?? Object.keys(u.wrestlers)[0]));
  const [opponentId, setOpponentId] = useState(() => {
    const p = u.wrestlers[playerId];
    const o = params.get("o");
    if (o && u.wrestlers[o]) return o;
    return Object.values(u.wrestlers).find((w) => w.id !== p.id && w.division === p.division && isSigned(w) && Math.abs(overall(w, u.settings) - overall(p, u.settings)) <= 4)?.id ?? signedStars.find((w) => w.id !== p.id && w.division === p.division)!.id;
  });
  const [titleId, setTitleId] = useState<string>("");
  const [side, setSide] = useState<"A" | "B">("A");
  const [running, setRunning] = useState<{ config: MatchConfig; key: number } | null>(null);

  // ── Booked match ("Play this match" from a show card) ──
  if (showId && segId) {
    if (!booked) return <EmptyState title="That booked match no longer exists" action={<Link href="/booking"><Button>Back to booking</Button></Link>} />;
    const { show, seg } = booked;
    if (show.status !== "planned") return <EmptyState title={`${show.name} has already run`} action={<Link href={`/shows/${show.id}`}><Button>See results</Button></Link>} />;
    if (seg.kind !== "match" || seg.matchType !== "singles" || seg.sideA.length !== 1 || seg.sideB.length !== 1) {
      return <EmptyState title="Only singles matches can be played in the ring for now" action={<Link href={`/booking/${show.id}`}><Button>Back to the card</Button></Link>}>Tag-team and triple-threat matches are simulated. Change the match to singles to play it yourself.</EmptyState>;
    }
    const a = u.wrestlers[seg.sideA[0]];
    const b = u.wrestlers[seg.sideB[0]];
    const injured = [a, b].filter((w) => w.injury);
    const start = (k = 0) =>
      setRunning({ key: Date.now() + k, config: { player: side === "A" ? a : b, opponent: side === "A" ? b : a, titleId: seg.titleId, source: { kind: "booking", showId: show.id, segId: seg.id, playerSide: side } } });
    if (running) return <LiveMatch key={running.key} u={u} config={running.config} onExit={() => setRunning(null)} onRematch={() => start(1)} />;
    return (
      <div className="space-y-6">
        <PageHeader title="Play the match" subtitle={`${seg.label} on ${show.name}. The result you earn in the ring is locked into the card and counts when the show runs.`} />
        {seg.titleId && (
          <div className="gold-plate inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-bold">
            <Crown size={14} /> {u.championships[seg.titleId].name}
          </div>
        )}
        <Panel>
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
            <TaleOfTheTape u={u} w={a} side="left" />
            <div className="font-display text-center text-5xl text-muted">vs</div>
            <TaleOfTheTape u={u} w={b} side="right" />
          </div>
          <div className="mt-6 grid gap-4 border-t border-rope pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="You control">
              <div className="flex gap-2">
                {(["A", "B"] as const).map((sd) => (
                  <button key={sd} onClick={() => setSide(sd)} aria-pressed={side === sd} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-semibold ring-1", side === sd ? "bg-ink text-arena ring-ink" : "ring-rope hover:ring-muted")}>
                    {sideName(u, sd === "A" ? seg.sideA : seg.sideB)}
                  </button>
                ))}
              </div>
            </Field>
            <Button variant="gold" size="lg" onClick={() => start()} disabled={injured.length > 0}>
              <Gamepad2 size={18} /> Ring the bell
            </Button>
          </div>
          {injured.length > 0 && <p className="mt-2 text-sm text-bad">{injured.map((w) => w.ringName).join(" and ")} is injured and can't wrestle.</p>}
        </Panel>
        <Panel title="Controls">
          <ControlsGuide controls={u.settings.controls} />
        </Panel>
      </div>
    );
  }

  // ── Quick match ──
  const player = u.wrestlers[playerId];
  const opponent = u.wrestlers[opponentId] && u.wrestlers[opponentId].division === player.division ? u.wrestlers[opponentId] : null;
  const titles = opponent
    ? Object.values(u.championships).filter((t) => !t.isTag && t.division === player.division && t.holderIds.length === 1 && [player.id, opponent.id].includes(t.holderIds[0]))
    : [];
  const titleAllowed = opponent && isSigned(player) && isSigned(opponent);
  const start = (k = 0) => opponent && setRunning({ key: Date.now() + k, config: { player, opponent, titleId: titleAllowed && titleId ? titleId : null, source: { kind: "exhibition" } } });
  if (running) return <LiveMatch key={running.key} u={u} config={running.config} onExit={() => setRunning(null)} onRematch={() => start(1)} />;

  const random = () => {
    const pool = Object.values(u.wrestlers).filter((w) => w.division === player.division && w.id !== player.id && !w.injury);
    setOpponentId(pool[Math.floor(Math.random() * pool.length)].id);
    setTitleId("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Play a match"
        subtitle="A one-on-one match in the 3D ring against an AI opponent. The result goes into this universe's history, records and popularity."
        actions={
          <Link href="/booking">
            <Button variant="ghost">Play a booked match from a show card instead</Button>
          </Link>
        }
      />
      <Panel>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-4">
            <Field label="You">
              <WrestlerSelect
                u={u}
                value={playerId}
                label="Your wrestler"
                onChange={(id) => {
                  setPlayerId(id);
                  setTitleId("");
                  if (u.wrestlers[opponentId]?.division !== u.wrestlers[id].division || opponentId === id) {
                    setOpponentId(Object.values(u.wrestlers).find((w) => w.id !== id && w.division === u.wrestlers[id].division)!.id);
                  }
                }}
              />
            </Field>
            <TaleOfTheTape u={u} w={player} side="left" />
          </div>
          <div className="font-display self-center text-center text-6xl text-muted">vs</div>
          <div className="space-y-4">
            <Field label="Opponent (AI)">
              <div className="flex gap-2">
                <WrestlerSelect u={u} value={opponentId} label="Opponent" onChange={(id) => (setOpponentId(id), setTitleId(""))} exclude={playerId} division={player.division} />
                <Button onClick={random} title="Random opponent" aria-label="Random opponent">
                  <Shuffle size={16} />
                </Button>
              </div>
            </Field>
            {opponent && <TaleOfTheTape u={u} w={opponent} side="right" />}
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-rope pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Championship" hint={titles.length === 0 ? "Neither wrestler holds a singles title." : !titleAllowed ? "Both wrestlers must be under contract to put a title on the line." : "The title changes hands if the challenger wins by pinfall or submission."}>
            <select className={selectClass} value={titleId} onChange={(e) => setTitleId(e.target.value)} disabled={!titles.length || !titleAllowed}>
              <option value="">Non-title exhibition</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({sideName(u, t.holderIds)} defends)
                </option>
              ))}
            </select>
          </Field>
          <Button variant="gold" size="lg" disabled={!opponent || !!player.injury || !!opponent?.injury} onClick={() => start()}>
            <Gamepad2 size={18} /> Ring the bell
          </Button>
        </div>
        {(player.injury || opponent?.injury) && <p className="mt-2 text-sm text-bad">Injured wrestlers can't compete. Pick someone healthy.</p>}
        <p className="mt-3 text-xs text-muted">
          AI difficulty: <span className="capitalize text-ink">{u.settings.difficulty}</span> · time limit {u.settings.matchMinutes} min ·{" "}
          <button className="underline hover:text-ink" onClick={() => router.push("/settings")}>
            change in Settings
          </button>
        </p>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Controls">
          <ControlsGuide controls={u.settings.controls} />
        </Panel>
        <Panel title="How to win">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
            <li>Wear your opponent down with strikes and grapples. Every move costs stamina — a tired wrestler hits softer and moves slower.</li>
            <li>Landing moves builds momentum. At 60 your signature unlocks; fill the meter for a finisher (you can bank two).</li>
            <li>Watch for the blue reversal prompt as your opponent winds up and press reverse at that moment. Mistimed presses lock you out briefly.</li>
            <li>Pin a downed opponent. The lower their health, and especially right after a finisher, the harder it is for them to kick out.</li>
            <li>When you are pinned or caught in a submission, mash the pin key to fill the escape meter. A finisher is powerful, but it does not automatically win.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={null}>
      <MatchPageInner />
    </Suspense>
  );
}
