"use client";

import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { CourtArt } from "@/components/home/court-art";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/clipboard";
import { CODE_LENGTH, isValidCode, normalizeCode } from "@/lib/domain/codes";
import { forgetTournament, useRecentTournaments } from "@/lib/recent";
import { cn } from "@/lib/utils";

export function HomeScreen() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pt-6 pb-10 md:grid-cols-[1.1fr_1fr] md:pt-10">
        <section className="animate-rise">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-brand">
            <span className="size-1.5 rounded-full bg-brand" />
            Badminton tournaments · No sign-up
          </p>
          <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-6xl md:text-7xl">
            Your tournament.
            <br />
            <span className="text-muted-foreground">Your game.</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
            Draw fixtures, keep live scores and crown a champion. Everyone with the link sees every point as it happens.
          </p>

          <div className="mt-8 grid max-w-md gap-3">
            <Button size="2xl" className="w-full shadow-[0_10px_30px_-10px_var(--primary)]" render={<Link href="/new" />} nativeButton={false}>
              <PlusIcon />
              Create tournament
            </Button>
            <JoinForm />
          </div>
        </section>

        <section className="hidden md:block">
          <CourtArt />
        </section>
      </main>

      <RecentTournaments />

      <footer className="pb-safe">
        <p className="mx-auto max-w-6xl px-5 py-6 text-[13px] text-muted-foreground">
          Free to use. Tournaments are shared by link — keep your code with the people you play with.
        </p>
      </footer>
    </div>
  );
}

function JoinForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const code = normalizeCode(value);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidCode(code)) {
      setError(`Codes are ${CODE_LENGTH} letters and numbers, like BDM482.`);
      return;
    }
    router.push(`/t/${code}`);
  };

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="join-code" className="sr-only">
        Tournament code
      </label>
      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-2xl border bg-card pr-1.5 pl-4 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          error && "border-destructive",
        )}
      >
        <input
          id="join-code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Have a code? Enter it here"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "join-error" : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base font-medium tracking-wide uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon-xl"
          variant={code.length === CODE_LENGTH ? "default" : "secondary"}
          aria-label="Join tournament"
        >
          <ArrowRightIcon />
        </Button>
      </div>
      {error && (
        <p id="join-error" className="mt-2 pl-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function RecentTournaments() {
  const recent = useRecentTournaments();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!hydrated || !recent.length) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-6">
      <h2 className="mb-3 text-[13px] font-medium tracking-wide text-muted-foreground uppercase">Recent</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((t) => (
          <li key={t.code} className="group relative">
            <Link
              href={`/t/${t.code}`}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 pr-12 ring-1 ring-border transition-all hover:ring-foreground/20 active:scale-[0.99]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-mono text-[13px] font-semibold">
                {t.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="block text-[13px] text-muted-foreground">
                  <span className="font-mono">{t.code}</span> · {timeAgo(t.visitedAt)}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => forgetTournament(t.code)}
              className="absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Remove ${t.name} from recent`}
            >
              <XIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
