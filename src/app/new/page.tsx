import type { Metadata } from "next";
import { CreateWizard } from "@/components/create/create-wizard";

export const metadata: Metadata = { title: "New tournament" };

export default function Page() {
  return <CreateWizard />;
}
