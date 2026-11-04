import { Suspense } from "react";
import { ScoringRoute } from "@/components/tournament/scoring-screen";
import { TournamentSkeleton } from "@/components/tournament/tournament-context";

export const instant = false;

export default function Page({ params }: PageProps<"/t/[code]/m/[matchId]">) {
  return (
    <Suspense fallback={<TournamentSkeleton />}>
      <ScoringRoute params={params} />
    </Suspense>
  );
}
