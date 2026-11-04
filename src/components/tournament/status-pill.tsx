import { CheckIcon } from "lucide-react";
import type { MatchStatus } from "@/lib/domain/types";
import { STATUS_LABELS, type TournamentStatus } from "@/lib/domain/progress";
import { cn } from "@/lib/utils";

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden>
      <span className="absolute inset-0 animate-live-pulse rounded-full bg-brand" />
    </span>
  );
}

export function TournamentStatusPill({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold",
        status === "live" && "bg-brand-soft text-brand",
        status === "completed" && "bg-foreground text-background",
        (status === "setup" || status === "in-progress") && "bg-muted text-muted-foreground",
      )}
    >
      {status === "live" && <LiveDot className="size-1.5" />}
      {status === "completed" && <CheckIcon className="size-3" strokeWidth={3} />}
      {STATUS_LABELS[status]}
    </span>
  );
}

const MATCH_LABELS: Record<MatchStatus, string> = {
  waiting: "Waiting",
  upcoming: "Upcoming",
  live: "Live",
  completed: "Final",
};

export function MatchStatusPill({ status, className }: { status: MatchStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold tracking-wide uppercase",
        status === "live" && "bg-primary text-primary-foreground",
        status === "upcoming" && "bg-muted text-foreground/80",
        status === "waiting" && "bg-muted/60 text-muted-foreground",
        status === "completed" && "text-muted-foreground ring-1 ring-border ring-inset",
        className,
      )}
    >
      {status === "live" && <span className="size-1.5 animate-live-pulse rounded-full bg-primary-foreground" />}
      {MATCH_LABELS[status]}
    </span>
  );
}
