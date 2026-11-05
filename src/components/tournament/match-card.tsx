"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { ShuttleGlyph } from "@/components/logo";
import { MatchStatusPill } from "@/components/tournament/status-pill";
import { useTournament } from "@/components/tournament/tournament-context";
import { roundLabel, type RoundContext } from "@/lib/domain/labels";
import { gamesWon, gameWinner } from "@/lib/domain/scoring";
import { scoringRulesOf, type Match, type Side } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const MARK_TONES = [
  "bg-[oklch(0.9_0.16_128/0.45)] text-[oklch(0.36_0.09_145)] dark:bg-[oklch(0.86_0.17_128/0.22)] dark:text-[oklch(0.9_0.15_128)]",
  "bg-[oklch(0.88_0.06_230/0.45)] text-[oklch(0.38_0.07_240)] dark:bg-[oklch(0.72_0.08_235/0.24)] dark:text-[oklch(0.88_0.06_230)]",
  "bg-[oklch(0.9_0.08_75/0.5)] text-[oklch(0.42_0.09_65)] dark:bg-[oklch(0.78_0.1_80/0.22)] dark:text-[oklch(0.9_0.09_90)]",
  "bg-[oklch(0.9_0.06_25/0.4)] text-[oklch(0.45_0.12_25)] dark:bg-[oklch(0.7_0.12_25/0.22)] dark:text-[oklch(0.9_0.06_25)]",
  "bg-[oklch(0.88_0.06_305/0.35)] text-[oklch(0.42_0.1_305)] dark:bg-[oklch(0.7_0.1_305/0.24)] dark:text-[oklch(0.9_0.06_305)]",
  "bg-[oklch(0.88_0.06_190/0.4)] text-[oklch(0.36_0.07_195)] dark:bg-[oklch(0.72_0.07_190/0.24)] dark:text-[oklch(0.88_0.07_190)]",
];

function toneFor(id: string | null, name: string) {
  const key = id ?? name;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 33 + key.charCodeAt(i)) >>> 0;
  return MARK_TONES[hash % MARK_TONES.length];
}

export function sideMonogram(name: string) {
  if (name === "TBD" || name === "Unknown") return "–";
  if (name === "Bye") return "BY";
  const duo = name.split(/\s*&\s*/);
  const initial = (part: string) => part.trim().charAt(0);
  if (duo.length === 2 && initial(duo[0]) && initial(duo[1])) {
    return (initial(duo[0]) + initial(duo[1])).toUpperCase();
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function SideMark({
  id,
  name,
  className,
}: {
  id: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-2xl text-[13px] font-semibold tracking-tight",
        toneFor(id, name),
        className,
      )}
      aria-hidden
    >
      {sideMonogram(name)}
    </span>
  );
}

export function MatchCard({ match, ctx, showRound = true }: { match: Match; ctx: RoundContext; showRound?: boolean }) {
  const { view, href, tournament } = useTournament();
  const rules = scoringRulesOf(tournament);
  const singleGame = rules.matchLength === "single";
  const live = match.status === "live";
  const playable = match.status !== "waiting";
  const games = match.games.filter((g, i) => i < match.games.length - 1 || g.a > 0 || g.b > 0 || match.status === "live");
  const sets = gamesWon(match.games, rules);
  const nameA = view.nameOf(match.a);
  const nameB = view.nameOf(match.b);

  const meta = [
    showRound ? roundLabel(match, ctx) : `Match ${match.slot + 1}`,
    match.court ? `Court ${match.court}` : null,
    match.endedEarly ? "Retired" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <ShuttleGlyph className="pointer-events-none absolute -right-2 -bottom-3 size-24 rotate-[18deg] text-foreground/[0.045]" />
      <div
        className={cn(
          "pointer-events-none absolute -top-10 right-6 size-28 rounded-full blur-2xl",
          live ? "bg-primary/25" : "bg-primary/10",
        )}
      />

      <div className="relative flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {meta}
        </span>
        <MatchStatusPill status={match.status} />
      </div>

      <div className="relative mt-3.5 grid">
        {(["A", "B"] as Side[]).map((side, index) => {
          const id = side === "A" ? match.a : match.b;
          const name = side === "A" ? nameA : nameB;
          const won = match.winner === side;
          const lost = match.status === "completed" && !won;
          return (
            <div key={side} className="grid">
              {index === 1 && games.length === 0 && (
                <div className="relative z-10 -my-1.5 flex pl-3.5">
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-muted-foreground ring-1 ring-border">
                    VS
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-1.5 py-1.5",
                  won && "bg-brand-soft",
                )}
              >
                <SideMark id={id} name={name} className={cn(lost && "opacity-60")} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[15px] leading-tight",
                    won ? "font-semibold" : "font-medium",
                    lost && "text-muted-foreground",
                    id === null && "text-muted-foreground italic",
                  )}
                >
                  {name}
                </span>
                {games.length > 0 && (
                  <span className="flex items-center gap-0.5 rounded-xl bg-muted/80 p-0.5">
                    {games.map((g, i) => {
                      const isCurrent = live && i === match.games.length - 1;
                      const value = side === "A" ? g.a : g.b;
                      const wonGame = gameWinner(g, rules) === side;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "grid h-8 min-w-8 place-items-center rounded-[10px] px-1 text-[15px] tabular-nums",
                            isCurrent
                              ? "bg-primary text-[16px] font-bold text-primary-foreground"
                              : wonGame
                                ? "bg-card font-semibold text-foreground shadow-sm"
                                : "text-muted-foreground",
                          )}
                        >
                          {value}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-border/80 pt-3">
        <span className="text-[13px] font-medium text-muted-foreground">
          {match.status === "live" && "Open the scoreboard"}
          {match.status === "upcoming" && "Tap to start scoring"}
          {match.status === "waiting" && "Waiting on an earlier result"}
          {match.status === "completed" &&
            (match.endedEarly ? "Ended early" : singleGame ? "Game Completed" : "Sets played")}
        </span>
        {match.status === "completed" ? (
          singleGame ? null : (
            <span className="font-mono text-sm font-semibold tabular-nums">
              {sets.a}
              <span className="px-0.5 text-muted-foreground">–</span>
              {sets.b}
            </span>
          )
        ) : playable ? (
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowRightIcon className="size-3.5" />
          </span>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "group relative block overflow-hidden rounded-[1.75rem] bg-card p-4 ring-1 ring-border transition duration-200",
    "shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]",
    live && "ring-2 ring-primary shadow-[0_18px_40px_-22px_var(--primary)]",
    playable && "hover:-translate-y-0.5 hover:ring-foreground/20 hover:shadow-[0_22px_44px_-26px_rgb(0_0_0/0.55)] active:translate-y-0 active:scale-[0.99]",
    !playable && "opacity-70",
  );

  if (!playable) {
    return (
      <div className={className} aria-disabled>
        {body}
      </div>
    );
  }
  return (
    <Link href={href(`/m/${match.id}`)} className={className} aria-label={`${nameA} versus ${nameB}, ${match.status}`}>
      {body}
    </Link>
  );
}
