"use client";

import { CalendarRangeIcon } from "lucide-react";
import { useState } from "react";
import { MatchCard } from "@/components/tournament/match-card";
import { NextStepCard } from "@/components/tournament/next-step";
import { useTournament } from "@/components/tournament/tournament-context";
import { roundContext, roundLabel } from "@/lib/domain/labels";
import type { Match } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "live" | "upcoming" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const matchesFilter = (m: Match, f: Filter) =>
  f === "all" ||
  (f === "live" && m.status === "live") ||
  (f === "upcoming" && (m.status === "upcoming" || m.status === "waiting")) ||
  (f === "completed" && m.status === "completed");

const EMPTY_COPY: Record<Filter, string> = {
  all: "No matches yet.",
  live: "No matches are being played right now.",
  upcoming: "Nothing left to play.",
  completed: "No results yet. Finished matches show up here.",
};

export function MatchesScreen() {
  const { view } = useTournament();
  const [filter, setFilter] = useState<Filter>("all");
  const ctx = roundContext(view.matches);
  const all = view.visibleMatches;
  const shown = all.filter((m) => matchesFilter(m, filter));

  const sections: { label: string; matches: Match[] }[] = [];
  for (const m of shown) {
    const label = roundLabel(m, ctx);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.matches.push(m);
    else sections.push({ label, matches: [m] });
  }

  return (
    <div className="space-y-5 pt-2">
      <NextStepCard />

      {all.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter matches">
          {FILTERS.map((f) => {
            const count = all.filter((m) => matchesFilter(m, f.value)).length;
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all active:scale-95",
                  active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {f.value === "live" && count > 0 && (
                  <span className={cn("size-1.5 animate-live-pulse rounded-full", active ? "bg-primary" : "bg-brand")} />
                )}
                {f.label}
                <span className={cn("tabular-nums", active ? "opacity-60" : "opacity-70")}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {all.length === 0 ? (
        view.state.phase === "registration" ? null : (
          <EmptyMatches text={EMPTY_COPY.all} />
        )
      ) : shown.length === 0 ? (
        <EmptyMatches text={EMPTY_COPY[filter]} />
      ) : (
        <div className="space-y-6">
          {sections.map((s, i) => (
            <section key={`${s.label}-${i}`}>
              <h3 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {s.matches.map((m) => (
                  <MatchCard key={m.id} match={m} ctx={ctx} showRound={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyMatches({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-12 text-center">
      <CalendarRangeIcon className="size-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
