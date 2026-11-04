"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Grid2x2Icon,
  LayersIcon,
  Loader2Icon,
  RepeatIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CodeDisplay, ShareActions } from "@/components/share";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/data/refs";
import { createTournament, MAX_NAME_LENGTH } from "@/lib/data/tournaments";
import { FORMAT_LABELS, type CategoryChoice, type Format } from "@/lib/domain/types";
import { rememberTournament } from "@/lib/recent";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: { value: CategoryChoice; title: string; hint: string; icons: LucideIcon[] }[] = [
  { value: "singles", title: "Singles", hint: "One against one", icons: [UserIcon] },
  { value: "doubles", title: "Doubles", hint: "Pairs — we can draw random teams", icons: [UsersIcon] },
  { value: "both", title: "Both", hint: "Singles and doubles side by side", icons: [UserIcon, UsersIcon] },
];

const FORMAT_OPTIONS: { value: Format; hint: string; icon: LucideIcon }[] = [
  { value: "round_robin", hint: "Everyone plays everyone. Best for small groups.", icon: RepeatIcon },
  { value: "groups", hint: "Small groups, then the top players go to a knockout.", icon: Grid2x2Icon },
  { value: "knockout", hint: "Lose once and you're out. Fast and dramatic.", icon: TrophyIcon },
  { value: "double_elim", hint: "Out after two losses. A second chance for everyone.", icon: LayersIcon },
];

const NAME_IDEAS = ["Friday Night Smash", "Club Championship", "Office Open", "Summer Shuttle Cup"];

const STEPS = ["Name", "Events", "Format", "Create"] as const;

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<CategoryChoice>("singles");
  const [format, setFormat] = useState<Format>("round_robin");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step === 0) nameInput.current?.focus();
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [step]);

  const canContinue = step !== 0 || name.trim().length > 0;
  const next = () => canContinue && setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const pickThenAdvance = (apply: () => void) => {
    apply();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep((s) => s + 1), 180);
  };

  const create = async () => {
    setCreating(true);
    try {
      const code = await createTournament({ name, categories, format });
      rememberTournament(code, name.trim());
      setCreated(code);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    return <Created code={created} name={name.trim()} onOpen={() => router.push(`/t/${created}/players`)} />;
  }

  const onSubmitName = (e: FormEvent) => {
    e.preventDefault();
    next();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center gap-3 px-4">
          {step === 0 ? (
            <Button variant="ghost" size="icon-xl" render={<Link href="/" />} nativeButton={false} aria-label="Back to home">
              <ArrowLeftIcon />
            </Button>
          ) : (
            <Button variant="ghost" size="icon-xl" onClick={back} aria-label="Previous step">
              <ArrowLeftIcon />
            </Button>
          )}
          <div className="flex flex-1 gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
          <span className="w-11 text-right text-[13px] font-medium text-muted-foreground tabular-nums">
            {step + 1}/{STEPS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-6 pb-36">
        <div key={step} className="animate-rise">
          {step === 0 && (
            <form onSubmit={onSubmitName}>
              <StepTitle eyebrow="New tournament" title="What's it called?" />
              <input
                ref={nameInput}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                placeholder="Tournament name"
                aria-label="Tournament name"
                enterKeyHint="next"
                className="mt-6 w-full border-b-2 border-border bg-transparent pb-3 text-[28px] font-semibold tracking-tight outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary"
              />
              <div className="mt-5 flex flex-wrap gap-2">
                {NAME_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setName(idea)}
                    className="rounded-full bg-muted px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </form>
          )}

          {step === 1 && (
            <>
              <StepTitle eyebrow={name.trim()} title="Which events?" />
              <div className="mt-6 grid gap-3">
                {CATEGORY_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={categories === o.value}
                    onSelect={() => pickThenAdvance(() => setCategories(o.value))}
                    title={o.title}
                    hint={o.hint}
                    icon={
                      <span className="flex -space-x-1.5">
                        {o.icons.map((Icon, i) => (
                          <Icon key={i} className="size-5" />
                        ))}
                      </span>
                    }
                  />
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle eyebrow={name.trim()} title="Pick a format" />
              <div className="mt-6 grid gap-3">
                {FORMAT_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={format === o.value}
                    onSelect={() => pickThenAdvance(() => setFormat(o.value))}
                    title={FORMAT_LABELS[o.value]}
                    hint={o.hint}
                    icon={<o.icon className="size-5" />}
                  />
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle eyebrow="Ready" title="Looks good?" />
              <dl className="mt-6 divide-y overflow-hidden rounded-3xl bg-card ring-1 ring-border">
                <SummaryRow label="Name" value={name.trim()} onEdit={() => setStep(0)} />
                <SummaryRow
                  label="Events"
                  value={CATEGORY_OPTIONS.find((o) => o.value === categories)!.title}
                  onEdit={() => setStep(1)}
                />
                <SummaryRow label="Format" value={FORMAT_LABELS[format]} onEdit={() => setStep(2)} />
              </dl>
              <p className="mt-4 px-1 text-sm text-muted-foreground">
                You&apos;ll get a code and a link to share. Players are added next.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="pb-safe fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background to-background/0 pt-6">
        <div className="mx-auto w-full max-w-xl px-5 pb-4">
          {step < 3 ? (
            <Button size="2xl" className="w-full" disabled={!canContinue} onClick={next}>
              Continue
              <ArrowRightIcon />
            </Button>
          ) : (
            <Button size="2xl" className="w-full" disabled={creating} onClick={create}>
              {creating ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
              {creating ? "Creating…" : "Create tournament"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="truncate text-sm font-medium text-brand">{eyebrow}</p>
      <h1 className="mt-1 text-[32px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  hint,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-left ring-1 ring-border transition-all duration-200 active:scale-[0.985]",
        selected ? "ring-2 ring-primary" : "hover:ring-foreground/20",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold tracking-tight">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <dt className="w-20 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium">{value}</dd>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function Created({ code, name, onOpen }: { code: string; name: string; onOpen: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="pt-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="animate-rise text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="mt-6 text-[28px] font-semibold tracking-tight">{name} is ready</h1>
          <p className="mt-2 text-muted-foreground">Share the code so others can follow along and keep score.</p>
          <CodeDisplay code={code} className="mt-8" />
        </div>
        <div className="mt-8 animate-rise [animation-delay:80ms]">
          <ShareActions code={code} name={name} emphasizeShare={false} />
        </div>
      </main>
      <footer className="pb-safe mx-auto w-full max-w-md px-5 pb-4">
        <Button size="2xl" className="w-full" onClick={onOpen}>
          Add players
          <ArrowRightIcon />
        </Button>
      </footer>
    </div>
  );
}
