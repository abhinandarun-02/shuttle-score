"use client";

import Link from "next/link";
import { MatchStatusPill } from "@/components/tournament/status-pill";
import { useTournament } from "@/components/tournament/tournament-context";
import { roundLabel, type RoundContext } from "@/lib/domain/labels";
import { gameWinner } from "@/lib/domain/scoring";
import type { Match, Side } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function MatchCard({ match, ctx, showRound = true }: { match: Match; ctx: RoundContext; showRound?: boolean }) {
  const { view, href } = useTournament();
  const live = match.status === "live";
  const playable = match.status !== "waiting";
  const games = match.games.filter((g, i) => i < match.games.length - 1 || g.a > 0 || g.b > 0 || match.status === "live");

  const body = (
    <>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">
          {showRound ? roundLabel(match, ctx) : null}
          {match.court ? `${showRound ? " · " : ""}Court ${match.court}` : null}
          {match.endedEarly ? " · Retired" : null}
        </span>
        <MatchStatusPill status={match.status} />
      </div>
      <div className="grid gap-1">
        {(["A", "B"] as Side[]).map((side) => {
          const id = side === "A" ? match.a : match.b;
          const won = match.winner === side;
          const lost = match.status === "completed" && !won;
          return (
            <div key={side} className="flex h-9 items-center gap-2.5">
              <span
                className={cn(
                  "h-5 w-1 shrink-0 rounded-full transition-colors",
                  won ? "bg-brand" : "bg-transparent",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[16px]",
                  won && "font-semibold",
                  lost && "text-muted-foreground",
                  id === null && "text-muted-foreground italic",
                )}
              >
                {view.nameOf(id)}
              </span>
              <span className="flex items-center gap-1">
                {games.map((g, i) => {
                  const isCurrent = live && i === match.games.length - 1;
                  const value = side === "A" ? g.a : g.b;
                  const wonGame = gameWinner(g) === side;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "grid h-8 min-w-8 place-items-center rounded-lg px-1 text-[15px] tabular-nums",
                        isCurrent
                          ? "bg-primary text-[17px] font-bold text-primary-foreground"
                          : wonGame
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {value}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  const className = cn(
    "block rounded-3xl bg-card p-4 ring-1 ring-border transition-all duration-200",
    live && "ring-2 ring-primary shadow-[0_12px_32px_-16px_var(--primary)]",
    playable ? "hover:ring-foreground/20 active:scale-[0.99]" : "opacity-60",
    live && "hover:ring-primary",
  );

  if (!playable) {
    return (
      <div className={className} aria-disabled>
        {body}
      </div>
    );
  }
  return (
    <Link href={href(`/m/${match.id}`)} className={className} aria-label={`${view.nameOf(match.a)} versus ${view.nameOf(match.b)}, ${match.status}`}>
      {body}
    </Link>
  );
}
