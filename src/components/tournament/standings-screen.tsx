"use client";

import { ListOrderedIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { NextStepCard } from "@/components/tournament/next-step";
import { useTournament } from "@/components/tournament/tournament-context";
import { Button } from "@/components/ui/button";
import { groupName } from "@/lib/domain/labels";
import type { StandingRow } from "@/lib/domain/standings";
import { cn } from "@/lib/utils";

export function StandingsScreen() {
  const { view, href } = useTournament();
  const hasMatches = view.matches.some((m) => m.stage === "rr" || m.stage === "group");

  return (
    <div className="space-y-5 pt-2">
      {view.nextStep.kind === "complete" || view.nextStep.kind === "start-knockout" ? <NextStepCard /> : null}

      {!hasMatches ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center">
          <ListOrderedIcon className="size-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Standings appear once matches are drawn</p>
          <Button className="mt-4" variant="secondary" render={<Link href={href()} />} nativeButton={false}>
            Go to matches
          </Button>
        </div>
      ) : view.format === "groups" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {view.groups.map((g) => (
            <GroupCard
              key={g.index}
              title={groupName(g.index)}
              rows={g.rows}
              nameOf={view.nameOf}
              qualify={g.complete ? (view.state.qualifiersPerGroup ?? 0) : 0}
              advancing={view.state.qualifiersPerGroup ?? 0}
            />
          ))}
        </div>
      ) : (
        <GroupCard title="Overall" rows={view.standings} nameOf={view.nameOf} qualify={view.complete ? 1 : 0} advancing={0} />
      )}
    </div>
  );
}

function GroupCard({
  title,
  rows,
  nameOf,
  qualify,
  advancing,
}: {
  title: string;
  rows: StandingRow[];
  nameOf: (id: string | null) => string;
  qualify: number;
  advancing: number;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {advancing > 0 && (
          <span className="text-[12px] text-muted-foreground">Top {advancing} advance</span>
        )}
      </div>
      <div className="grid grid-cols-[1.5rem_1fr_repeat(4,2rem)] gap-1 px-4 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span />
        <span />
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-right">+/−</span>
      </div>
      <ol>
        {rows.map((r) => {
          const qualified = r.rank <= qualify;
          return (
            <li
              key={r.id}
              className={cn(
                "grid grid-cols-[1.5rem_1fr_repeat(4,2rem)] items-center gap-1 px-4 py-2.5",
                qualified && "bg-brand-soft",
              )}
            >
              <span className="font-mono text-sm text-muted-foreground tabular-nums">{r.rank}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                {qualified && <TrophyIcon className="size-3.5 shrink-0 text-brand" />}
                <span className={cn("truncate text-[15px]", r.rank === 1 && "font-semibold")}>{nameOf(r.id)}</span>
              </span>
              <span className="text-center text-sm tabular-nums">{r.played}</span>
              <span className="text-center text-sm font-medium tabular-nums">{r.won}</span>
              <span className="text-center text-sm text-muted-foreground tabular-nums">{r.lost}</span>
              <span
                className={cn(
                  "text-right font-mono text-sm tabular-nums",
                  r.pointDiff > 0 && "text-brand",
                  r.pointDiff < 0 && "text-muted-foreground",
                )}
              >
                {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
