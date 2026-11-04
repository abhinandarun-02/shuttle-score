import { cn } from "@/lib/utils";

export function ShuttleGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g transform="rotate(-38 12 12)">
        <path d="M9.2 15.6 5.4 3.8c2.2-.9 4.4-1.3 6.6-1.3s4.4.4 6.6 1.3l-3.8 11.8" />
        <path d="M12 15.4V2.6M10.6 15.5 8.6 3.1M13.4 15.5l2-12.4" opacity={0.75} />
        <path d="M8.8 15.4h6.4v1.3a3.2 3.2 0 0 1-6.4 0z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.08)]">
        <ShuttleGlyph className="size-[22px]" />
      </span>
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight">Shuttle</span>
      )}
    </span>
  );
}
