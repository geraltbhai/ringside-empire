"use client";

import { Meter } from "@/components/ui/primitives";
import type { AttributeKey } from "@/engine/types";

export const ATTRIBUTE_GROUPS: { label: string; keys: AttributeKey[] }[] = [
  { label: "Power", keys: ["strength", "striking", "durability"] },
  { label: "Technique", keys: ["grappling", "technical", "submission", "reversal", "defense"] },
  { label: "Athleticism", keys: ["aerial", "speed", "agility", "stamina", "recovery"] },
  { label: "Ring IQ", keys: ["psychology", "selling", "bigMatch", "tagChemistry"] },
  { label: "Star power", keys: ["charisma", "promo", "crowdConnection"] },
];

export function AttrBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 90 ? "gold" : value >= 80 ? "good" : value < 60 ? "bad" : "ink";
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-cond text-base font-semibold tabular-nums">{value}</span>
      <div className="col-span-2">
        <Meter value={value} tone={tone} label={label} />
      </div>
    </div>
  );
}

