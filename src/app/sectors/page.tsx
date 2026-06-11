import { SectorPulseView } from "@/components/sector-pulse-view";
import { PageHeader, WarningBanner } from "@/components/shared";

export const metadata = { title: "Sector Pulse" };

export default function SectorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market context"
        title="Sector pulse"
        description="Rank sector leadership, compare performance with SPY, and monitor fresh headlines tied to the morning watchlist and the broader market."
      />
      <WarningBanner>News is context, not confirmation. Read the full article, check its publication time, and validate price and volume before changing a trade plan.</WarningBanner>
      <SectorPulseView />
    </>
  );
}
