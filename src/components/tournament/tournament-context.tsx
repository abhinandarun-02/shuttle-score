"use client";

import { ArrowLeftIcon, SearchXIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentData } from "@/lib/data/hooks";
import { isValidCode, normalizeCode } from "@/lib/domain/codes";
import {
  buildCategoryView,
  tournamentStatus,
  type CategoryView,
  type TournamentStatus,
} from "@/lib/domain/progress";
import type { Category, Match, Player, Team, Tournament } from "@/lib/domain/types";
import { rememberTournament } from "@/lib/recent";

export interface TournamentContextValue {
  code: string;
  tournament: Tournament;
  players: Player[];
  teams: Team[];
  matches: Match[];
  fromCache: boolean;
  category: Category;
  view: CategoryView;
  views: CategoryView[];
  status: TournamentStatus;
  /** Builds a tournament-relative link that keeps the selected category. */
  href: (path?: string, category?: Category) => string;
  setCategory: (category: Category) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error("useTournament must be used inside a tournament route");
  return ctx;
}

export function TournamentProvider({
  params,
  children,
}: {
  params: Promise<{ code: string }>;
  children: ReactNode;
}) {
  const { code: raw } = use(params);
  const code = normalizeCode(decodeURIComponent(raw));
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (raw !== code && isValidCode(code)) {
      router.replace(pathname.replace(`/t/${raw}`, `/t/${code}`));
    }
  }, [raw, code, pathname, router]);

  if (!isValidCode(code)) return <NotFoundScreen code={raw} />;
  return <TournamentLoader code={code}>{children}</TournamentLoader>;
}

function TournamentLoader({ code, children }: { code: string; children: ReactNode }) {
  const data = useTournamentData(code);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("c");

  const tournament = data.tournament;
  const categories = tournament?.categories ?? [];
  const category: Category =
    requested === "singles" || requested === "doubles"
      ? categories.includes(requested)
        ? requested
        : (categories[0] ?? "singles")
      : (categories[0] ?? "singles");

  const views = useMemo(
    () =>
      tournament
        ? tournament.categories.map((c) => buildCategoryView(tournament, c, data.players, data.teams, data.matches))
        : [],
    [tournament, data.players, data.teams, data.matches],
  );

  const href = useCallback(
    (path = "", cat: Category = category) => {
      const base = `/t/${code}${path}`;
      return categories.length > 1 ? `${base}?c=${cat}` : base;
    },
    [code, category, categories.length],
  );

  const setCategory = useCallback(
    (cat: Category) => {
      const rest = pathname.replace(`/t/${code}`, "");
      router.replace(href(rest, cat), { scroll: false });
    },
    [pathname, code, href, router],
  );

  useEffect(() => {
    if (tournament) rememberTournament(tournament.code, tournament.name);
  }, [tournament]);

  if (data.status === "not-found") return <NotFoundScreen code={code} />;
  if (data.status === "error" && (!tournament || !data.collectionsReady)) return <ErrorScreen message={data.error} />;
  if (!tournament || !views.length || !data.collectionsReady) return <TournamentSkeleton />;

  const view = views.find((v) => v.category === category) ?? views[0];
  const value: TournamentContextValue = {
    code,
    tournament,
    players: data.players,
    teams: data.teams,
    matches: data.matches,
    fromCache: data.fromCache,
    category: view.category,
    view,
    views,
    status: tournamentStatus(views),
    href,
    setCategory,
  };
  return <TournamentContext value={value}>{children}</TournamentContext>;
}

export function TournamentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-safe" aria-busy="true" aria-label="Loading tournament">
      <div className="flex h-16 items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="mt-4 h-11 w-full rounded-2xl" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

function FullScreenMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-3">
        <Button variant="ghost" size="icon-xl" render={<Link href="/" />} nativeButton={false} aria-label="Home">
          <ArrowLeftIcon />
        </Button>
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
        {action && <div className="mt-8 w-full">{action}</div>}
      </main>
    </div>
  );
}

export function NotFoundScreen({ code }: { code: string }) {
  return (
    <FullScreenMessage
      icon={<SearchXIcon className="size-7" />}
      title="Tournament not found"
      body={
        <>
          There&apos;s no tournament with the code <span className="font-mono font-semibold text-foreground">{code.toUpperCase()}</span>. Check the code and try again.
        </>
      }
      action={
        <Button size="2xl" className="w-full" render={<Link href="/" />} nativeButton={false}>
          Enter another code
        </Button>
      }
    />
  );
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <FullScreenMessage
      icon={<WifiOffIcon className="size-7" />}
      title="Couldn't load this tournament"
      body={message ?? "Check your connection and try again."}
      action={
        <Button size="2xl" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      }
    />
  );
}
