"use client";

import { ArrowRightIcon, CalendarRangeIcon, LayoutGridIcon, ListIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MatchCard, SideMark } from "@/components/tournament/match-card";
import { NextStepCard } from "@/components/tournament/next-step";
import { MatchStatusPill } from "@/components/tournament/status-pill";
import { useTournament } from "@/components/tournament/tournament-context";
import { roundContext, roundLabel, type RoundContext } from "@/lib/domain/labels";
import type { Match } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "live" | "upcoming" | "completed";

const FILTERS: { value: Filter; label: string; short: string }[] = [
  { value: "all", label: "All", short: "All" },
  { value: "live", label: "Live", short: "Live" },
  { value: "upcoming", label: "Upcoming", short: "Next" },
  { value: "completed", label: "Completed", short: "Done" },
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

type Layout = "rounds" | "list";

const LAYOUTS: { value: Layout; label: string; icon: LucideIcon }[] = [
  { value: "rounds", label: "Rounds", icon: LayoutGridIcon },
  { value: "list", label: "List", icon: ListIcon },
];

const isUpcoming = (m: Match) => m.status === "upcoming" || m.status === "waiting";

export function MatchesScreen() {
  const { view } = useTournament();
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<Layout>("rounds");
  const ctx = roundContext(view.matches);
  const all = view.visibleMatches;
  const roundRobin = view.format === "round_robin";
  const listLayout = roundRobin && layout === "list";
  const shown = listLayout
    ? all.filter(isUpcoming).sort((a, b) => a.round - b.round || a.slot - b.slot)
    : all.filter((m) => matchesFilter(m, filter));

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

      {all.length > 0 && !listLayout && (
        <div className="flex items-stretch gap-1 rounded-2xl bg-card p-1 ring-1 ring-border">
          <div className="@container/filters grid min-w-0 flex-1 grid-cols-4 gap-0.5" role="tablist" aria-label="Filter matches">
            {FILTERS.map((f) => {
              const count = all.filter((m) => matchesFilter(m, f.value)).length;
              const active = filter === f.value;
              const live = f.value === "live" && count > 0;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${f.label}, ${count}`}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 transition-all active:scale-[0.98] sm:h-10 sm:flex-row sm:gap-1.5 sm:px-2 sm:py-0",
                    active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="flex max-w-full items-center gap-1 text-[11px] leading-none font-medium tracking-wide sm:text-sm">
                    {live && (
                      <span className={cn("size-1.5 shrink-0 animate-live-pulse rounded-full", active ? "bg-primary" : "bg-brand")} />
                    )}
                    <span className="truncate @min-[260px]/filters:hidden sm:hidden">{f.short}</span>
                    <span className="hidden truncate @min-[260px]/filters:inline sm:inline">{f.label}</span>
                  </span>
                  <span
                    className={cn(
                      "text-[15px] leading-none font-semibold tabular-nums sm:grid sm:h-5 sm:min-w-5 sm:place-items-center sm:rounded-full sm:px-1 sm:text-[11px]",
                      active ? "text-background sm:bg-background/15" : "text-foreground sm:bg-muted sm:text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {roundRobin && <LayoutToggle layout={layout} onChange={setLayout} divided />}
        </div>
      )}

      {all.length === 0 ? (
        view.state.phase === "registration" ? null : (
          <EmptyMatches text={EMPTY_COPY.all} />
        )
      ) : shown.length === 0 ? (
        <div className="space-y-3">
          {listLayout && (
            <div className="flex justify-end px-1">
              <LayoutToggle layout={layout} onChange={setLayout} />
            </div>
          )}
          <EmptyMatches text={listLayout ? EMPTY_COPY.upcoming : EMPTY_COPY[filter]} />
        </div>
      ) : listLayout ? (
        <UpcomingList
          matches={shown}
          ctx={ctx}
          toggle={<LayoutToggle layout={layout} onChange={setLayout} />}
        />
      ) : (
        <div className="space-y-6">
          {sections.map((s, i) => (
            <section key={`${s.label}-${i}`}>
              <div className="mb-3 flex items-center gap-3 px-1">
                <h3 className="text-[13px] font-semibold tracking-[0.14em] text-foreground uppercase">{s.label}</h3>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                  {s.matches.length} {s.matches.length === 1 ? "match" : "matches"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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

function LayoutToggle({
  layout,
  onChange,
  divided,
}: {
  layout: Layout;
  onChange: (layout: Layout) => void;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5",
        divided ? "border-l border-border pl-1" : "rounded-xl bg-card p-0.5 ring-1 ring-border",
      )}
      role="tablist"
      aria-label="Match layout"
    >
      {LAYOUTS.map((item) => {
        const active = layout === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            title={item.label}
            onClick={() => onChange(item.value)}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function UpcomingList({
  matches,
  ctx,
  toggle,
}: {
  matches: Match[];
  ctx: RoundContext;
  toggle: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3 px-1">
        <h3 className="text-[13px] font-semibold tracking-[0.14em] text-foreground uppercase">Upcoming</h3>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
        {toggle}
      </div>
      <ul className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        {matches.map((match, index) => (
          <li key={match.id} className={cn(index > 0 && "border-t border-border")}>
            <MatchListRow match={match} ctx={ctx} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchListRow({ match, ctx }: { match: Match; ctx: RoundContext }) {
  const { view, href } = useTournament();
  const playable = match.status !== "waiting";
  const nameA = view.nameOf(match.a);
  const nameB = view.nameOf(match.b);
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {roundLabel(match, ctx)} · M{match.slot + 1}
          </p>
          <MatchStatusPill status={match.status} />
        </div>
        <div className="mt-2 grid gap-1.5">
          {(
            [
              ["A", match.a, nameA],
              ["B", match.b, nameB],
            ] as const
          ).map(([side, id, name]) => (
            <div key={side} className="flex min-w-0 items-center gap-2">
              <SideMark id={id} name={name} className="size-7 rounded-lg text-[11px]" />
              <span className={cn("truncate text-sm font-medium", id === null && "text-muted-foreground italic")}>{name}</span>
            </div>
          ))}
        </div>
      </div>
      {playable && <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const className = "flex items-center gap-3 px-3 py-3 transition-colors sm:px-4";
  if (!playable) {
    return (
      <div className={cn(className, "opacity-70")} aria-disabled>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href(`/m/${match.id}`)}
      className={cn(className, "hover:bg-muted/60 active:bg-muted")}
      aria-label={`${nameA} versus ${nameB}, ${roundLabel(match, ctx)}`}
    >
      {body}
    </Link>
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
