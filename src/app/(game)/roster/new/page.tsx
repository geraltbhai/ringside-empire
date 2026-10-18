"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { type EditorResult, WrestlerEditor } from "@/components/WrestlerEditor";
import { ATTRIBUTE_KEYS, type Attributes, type Wrestler } from "@/engine/types";
import { askingSalary, createCustomWrestler } from "@/engine/universe";
import { useUniverse } from "@/store/game";

function blankWrestler(week: number): Wrestler {
  const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 65])) as Attributes;
  return {
    id: "new",
    baseId: null,
    versionLabel: null,
    name: "",
    ringName: "New Wrestler",
    nickname: "The Newcomer",
    brand: "free-agents",
    division: "men",
    weightClass: "heavyweight",
    weightLbs: 230,
    heightIn: 73,
    age: 25,
    era: "modern",
    style: "all-rounder",
    alignment: "face",
    attributes,
    overallOverride: null,
    popularity: 50,
    potential: 80,
    morale: 70,
    momentum: 50,
    fatigue: 0,
    injury: null,
    finisher: "Custom Finisher",
    signatures: ["Dropkick", "Suplex"],
    theme: "Untitled Theme",
    record: { wins: 0, losses: 0, draws: 0 },
    contract: { status: "free-agent", weeklySalary: 0, weeksRemaining: 0, signedWeek: week },
    teamId: null,
    allies: [],
    appearance: { skinTone: "#c98e62", hairColor: "#1c1917", hairStyle: "short", facialHair: "none", primaryColor: "#0d9488", secondaryColor: "#f8fafc", outfit: "trunks", bulk: 0.4, mask: false },
    trend: "rising",
    isCustom: true,
    lastMatchWeek: null,
    recentMatches: [],
  };
}

export default function NewWrestlerPage() {
  const u = useUniverse();
  const router = useRouter();
  const run = useAction();
  const initial = useMemo(() => blankWrestler(u.week), [u.week]);

  const save = ({ draft }: EditorResult) => {
    const created = run((d) => {
      const { id: _id, ...rest } = draft;
      const w = createCustomWrestler(d, { ...rest, brand: "free-agents" });
      w.contract.weeklySalary = askingSalary(d, w);
      return w;
    }, (w) => `${w.ringName} created — sign them from Contracts`);
    if (created) router.push(`/roster/${created.id}`);
  };

  return (
    <div>
      <PageHeader title="Create wrestler" subtitle="New wrestlers join the free-agent pool. Sign them from the Contracts screen to put them on a brand." />
      <WrestlerEditor universe={u} initial={initial} isNew onSave={save} />
    </div>
  );
}
