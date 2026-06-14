import { DueDiligenceView } from "@/components/due-diligence-view";
import { PageHeader } from "@/components/shared";

export const metadata = { title: "Due Diligence" };

export default function DueDiligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="Long-term portfolio research"
        title="Due diligence"
        description="Build an evidence-based bull case for a stock, ETF, or index across financials, outlook, contracts, and sector strength. Scores normalize around the data that is actually available."
        variant="hero"
      />
      <DueDiligenceView />
    </>
  );
}
