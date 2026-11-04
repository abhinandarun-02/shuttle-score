import { TournamentChrome } from "@/components/tournament/tournament-chrome";

// The tournament UI is loaded live from Firestore in the browser, so it cannot be
// prerendered into an instant shell.
export const instant = false;

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return <TournamentChrome>{children}</TournamentChrome>;
}
