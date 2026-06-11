import { PageHeader } from "@/components/shared";
import { TickerResearchView } from "@/components/ticker-research-view";

export const metadata = { title: "Ticker Research" };

export default function TickerResearchPage() {
  return (
    <>
      <PageHeader
        eyebrow="On-demand single-symbol analysis"
        title="Ticker research"
        description="Research a stock that was not captured by the morning scan. The same completed-daily pattern engine grades its sector context, horizontal trigger, extension, and options tradability."
        variant="hero"
      />
      <TickerResearchView />
    </>
  );
}

