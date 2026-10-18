"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { type EditorResult, WrestlerEditor } from "@/components/WrestlerEditor";
import { createTeam, disbandTeam, restoreDefaults, transferWrestler, updateWrestler } from "@/engine/universe";
import { useUniverse } from "@/store/game";

export default function EditWrestlerPage() {
  const { id } = useParams<{ id: string }>();
  const u = useUniverse();
  const router = useRouter();
  const run = useAction();
  const w = u.wrestlers[id];
  if (!w) return <EmptyState title="Wrestler not found" />;

  const save = ({ draft, brand, team }: EditorResult) => {
    const ok = run((d) => {
      const { brand: _ignored, teamId: _t, record: _r, contract, ...patch } = draft;
      updateWrestler(d, id, { ...patch, contract: { ...d.wrestlers[id].contract, weeklySalary: contract.weeklySalary } });
      if ((brand === "mayhem" || brand === "fury") && brand !== d.wrestlers[id].brand) transferWrestler(d, id, brand);
      if (team.mode === "leave" && d.wrestlers[id].teamId) disbandTeam(d, d.wrestlers[id].teamId!);
      if (team.mode === "form") createTeam(d, team.name, id, team.partnerId);
      return true;
    }, "Changes saved");
    if (ok) router.push(`/roster/${id}`);
  };

  return (
    <div>
      <Link href={`/roster/${id}`} className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {w.ringName}
      </Link>
      <PageHeader title={`Edit ${w.ringName}`} subtitle="Every rating is editable. Changes persist in this universe; Restore default ratings brings back the original database values." />
      <WrestlerEditor key={w.id + u.updatedAt} universe={u} initial={w} onSave={save} onRestore={() => run((d) => restoreDefaults(d, id), "Ratings restored")} />
    </div>
  );
}
