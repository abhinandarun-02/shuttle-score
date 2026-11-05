"use client";

import {
  ActivityIcon,
  ArrowLeftIcon,
  CloudOffIcon,
  EllipsisIcon,
  ListOrderedIcon,
  MoonIcon,
  PencilIcon,
  Share2Icon,
  SunIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
import { ShareSheet } from "@/components/share";
import { useResolvedTheme } from "@/components/theme-toggle";
import { TournamentStatusPill } from "@/components/tournament/status-pill";
import { useTournament } from "@/components/tournament/tournament-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOnline } from "@/lib/data/hooks";
import { describeError } from "@/lib/data/refs";
import { MAX_NAME_LENGTH, renameTournament } from "@/lib/data/tournaments";
import { CATEGORY_LABELS, FORMAT_LABELS, scoringRulesOf, scoringSummary, type Format } from "@/lib/domain/types";
import { setThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

function navItems(format: Format, doubles: boolean): NavItem[] {
  const items: NavItem[] = [
    { path: "", label: "Matches", icon: ActivityIcon },
    { path: "/players", label: doubles ? "Teams" : "Players", icon: UsersIcon },
  ];
  if (format === "round_robin" || format === "groups") {
    items.push({ path: "/standings", label: "Standings", icon: ListOrderedIcon });
  }
  if (format !== "round_robin") items.push({ path: "/bracket", label: "Bracket", icon: TrophyIcon });
  return items;
}

export function TournamentChrome({ children }: { children: ReactNode }) {
  const { tournament, code, category, href, status } = useTournament();
  const pathname = usePathname();
  const online = useOnline();
  useEffect(() => {
    document.title = `${tournament.name} · Shuttle`;
  }, [tournament.name]);
  const [shareOpen, setShareOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const items = navItems(tournament.format, category === "doubles");
  const active = pathname.replace(`/t/${code}`, "") || "";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 bg-[radial-gradient(ellipse_at_top,var(--brand-soft),transparent_68%)]"
      />
      <header className="pt-safe sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-1.5 px-2 sm:px-4">
          <Button variant="ghost" size="icon-xl" render={<Link href="/" />} nativeButton={false} aria-label="Home">
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-[17px] leading-tight font-semibold tracking-tight">{tournament.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="font-mono font-semibold tracking-wider text-foreground/80 hover:text-foreground"
                aria-label={`Tournament code ${code}. Open share options`}
              >
                {code}
              </button>
              <TournamentStatusPill status={status} />
              <span className="hidden truncate sm:inline">
                {FORMAT_LABELS[tournament.format]} · {scoringSummary(scoringRulesOf(tournament))}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon-xl" onClick={() => setShareOpen(true)} aria-label="Share tournament">
            <Share2Icon />
          </Button>
          <MoreMenu onRename={() => setRenameOpen(true)} />
        </div>

        <div className="mx-auto w-full max-w-3xl px-4">
          <CategorySwitch />
          <nav className="hidden pb-3 md:block" aria-label="Tournament sections">
            <div className="inline-flex gap-1 rounded-2xl bg-muted p-1">
              {items.map((item) => {
                const isActive = active === item.path;
                return (
                  <Link
                    key={item.path}
                    href={href(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all",
                      isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-[13px] font-medium text-background">
            <CloudOffIcon className="size-4" />
            You&apos;re offline — showing saved data. Scoring resumes when you reconnect.
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pt-3 pb-32 md:pb-16">{children}</main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 backdrop-blur-xl md:hidden"
        aria-label="Tournament sections"
      >
        <div className="mx-auto flex max-w-md">
          {items.map((item) => {
            const isActive = active === item.path;
            return (
              <Link
                key={item.path}
                href={href(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-all duration-200",
                    isActive && "bg-primary text-primary-foreground",
                  )}
                >
                  <item.icon className="size-[18px]" strokeWidth={isActive ? 2.25 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} code={code} name={tournament.name} />
      <RenameSheet open={renameOpen} onOpenChange={setRenameOpen} />
    </div>
  );
}

function CategorySwitch() {
  const { tournament, category, setCategory, views } = useTournament();
  if (tournament.categories.length < 2) return null;
  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label="Event">
      {tournament.categories.map((c) => {
        const v = views.find((x) => x.category === c);
        const live = v?.visibleMatches.filter((m) => m.status === "live").length ?? 0;
        const selected = c === category;
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setCategory(c)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {CATEGORY_LABELS[c]}
            {live > 0 && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                <span className="size-1.5 animate-live-pulse rounded-full bg-primary-foreground" />
                {live}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MoreMenu({ onRename }: { onRename: () => void }) {
  const theme = useResolvedTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xl" aria-label="More options" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={onRename}>
          <PencilIcon />
          Rename tournament
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePref(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tournament, code } = useTournament();
  const [value, setValue] = useState(tournament.name);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(tournament.name);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await renameTournament(code, value);
      onOpenChange(false);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Rename tournament">
      <form onSubmit={save} className="grid gap-4">
        <input
          autoFocus
          value={value}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Tournament name"
          className="h-14 rounded-2xl bg-muted px-4 text-lg font-medium outline-none focus:ring-3 focus:ring-ring/40"
        />
        <Button size="xl" type="submit" disabled={saving || !value.trim()}>
          Save
        </Button>
      </form>
    </BottomSheet>
  );
}
