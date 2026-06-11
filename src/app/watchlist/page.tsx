import { PageHeader, WarningBanner } from "@/components/shared";
import { WatchlistView } from "@/components/watchlist-view";

export const metadata = { title: "Morning Watchlist" };

export default function WatchlistPage() {
  return (
    <>
      <PageHeader eyebrow="Latest live scan" title="Morning watchlist" description="The strongest candidates from the latest completed local scan, with measured trigger, invalidation, target, context, and extension risk." />
      <WarningBanner>Candidates use completed daily candles. Confirm the live opening price, volume, and market structure with your broker before entering a trade.</WarningBanner>
      <WatchlistView />
    </>
  );
}
