import { JournalDashboard } from "@/components/journal-dashboard";
import { PageHeader } from "@/components/shared";

export const metadata = { title: "Trading Journal" };

export default function JournalPage() {
  return (
    <>
      <PageHeader
        eyebrow="Process over outcome"
        title="Trading journal"
        description="Record the trade, grade the decision, and turn repeated behavior into a process you can actually improve."
      />
      <JournalDashboard />
    </>
  );
}
