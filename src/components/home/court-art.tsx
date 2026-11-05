import { ShuttleGlyph } from "@/components/logo";

/** Decorative top-down badminton court with a shuttle trajectory. */
export function CourtArt() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px]" aria-hidden>
      <div className="absolute -inset-8 rounded-full bg-brand/20 blur-3xl dark:bg-primary/16" />
      <div className="absolute inset-0 rounded-[36px] bg-card shadow-[0_40px_80px_-48px_rgb(0_0_0/0.85)] ring-1 ring-foreground/10" />
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full text-foreground/25">
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="60" y="40" width="280" height="420" rx="4" />
          <line x1="80" y1="40" x2="80" y2="460" />
          <line x1="320" y1="40" x2="320" y2="460" />
          <line x1="60" y1="64" x2="340" y2="64" />
          <line x1="60" y1="436" x2="340" y2="436" />
          <line x1="60" y1="190" x2="340" y2="190" />
          <line x1="60" y1="310" x2="340" y2="310" />
          <line x1="200" y1="40" x2="200" y2="190" />
          <line x1="200" y1="310" x2="200" y2="460" />
        </g>
        <line x1="44" y1="250" x2="356" y2="250" stroke="currentColor" strokeWidth="5" strokeDasharray="2 6" className="text-foreground/40" />
        <path
          d="M 120 400 C 150 260, 250 200, 285 120"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 10"
        />
        <circle cx="120" cy="400" r="7" fill="var(--brand)" opacity="0.35" />
      </svg>
      <div className="absolute top-[12%] right-[14%] size-28 rounded-full bg-primary/35 blur-2xl" />
      <div className="absolute top-[17%] right-[20%] grid size-16 rotate-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_22px_40px_-12px_rgb(0_0_0/0.45)] ring-1 ring-white/30">
        <ShuttleGlyph className="size-9" />
      </div>
    </div>
  );
}
