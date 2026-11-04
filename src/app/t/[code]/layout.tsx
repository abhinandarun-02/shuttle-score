import { Suspense } from "react";
import { TournamentProvider, TournamentSkeleton } from "@/components/tournament/tournament-context";

export default function TournamentLayout({ children, params }: LayoutProps<"/t/[code]">) {
  return (
    <Suspense fallback={<TournamentSkeleton />}>
      <TournamentProvider params={params}>{children}</TournamentProvider>
    </Suspense>
  );
}
