"use client";

import { CheckIcon, CopyIcon, LinkIcon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { copyText, tournamentUrl } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const noop = () => () => {};

function useCanShare() {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

function useUrl(code: string) {
  return useSyncExternalStore(noop, () => tournamentUrl(code), () => `/t/${code}`);
}

export function CodeDisplay({ code, className }: { code: string; className?: string }) {
  return (
    <div className={cn("flex justify-center gap-1.5", className)} aria-label={`Tournament code ${code.split("").join(" ")}`}>
      {code.split("").map((ch, i) => (
        <span
          key={i}
          className="grid h-14 w-11 place-items-center rounded-xl bg-muted font-mono text-[26px] font-semibold tracking-tight sm:h-16 sm:w-12"
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

export function ShareActions({ code, name, emphasizeShare = true }: { code: string; name: string; emphasizeShare?: boolean }) {
  const canShare = useCanShare();
  const url = useUrl(code);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const copy = async (what: "link" | "code") => {
    const ok = await copyText(what === "link" ? url : code);
    if (ok) {
      setCopied(what);
      toast.success(what === "link" ? "Link copied" : "Code copied");
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
    } else {
      toast.error("Couldn't access the clipboard");
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: name,
        text: `Follow ${name} live on Shuttle. Code: ${code}`,
        url,
      });
    } catch {
      // Dismissing the native share sheet is not an error.
    }
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
        <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Button size="xl" variant="secondary" onClick={() => copy("link")}>
          {copied === "link" ? <CheckIcon /> : <LinkIcon />}
          Copy link
        </Button>
        <Button size="xl" variant="secondary" onClick={() => copy("code")}>
          {copied === "code" ? <CheckIcon /> : <CopyIcon />}
          Copy code
        </Button>
      </div>
      {canShare && (
        <Button size="xl" variant={emphasizeShare ? "default" : "secondary"} onClick={share}>
          <Share2Icon />
          Share…
        </Button>
      )}
    </div>
  );
}

export function ShareSheet({
  open,
  onOpenChange,
  code,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  name: string;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Invite people"
      description="Anyone with this link or code can follow along and keep score."
    >
      <CodeDisplay code={code} className="mb-5 mt-1" />
      <ShareActions code={code} name={name} />
    </BottomSheet>
  );
}
