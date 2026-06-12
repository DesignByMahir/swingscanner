import { PageHeader } from "@/components/shared";
import { ScannerDashboard } from "@/components/scanner-dashboard";
import { MorningCommandCenter } from "@/components/morning-command-center";

export const metadata = { title: "Setup Scanner" };

export default function ScannerPage() {
  return (
    <>
      <PageHeader eyebrow="Leader-first completed candles" title="Morning setup scanner" description="The local engine finds the strongest stocks in the strongest themes first, then ranks breakouts, weekly 8-week EMA resets, reclaims, pullbacks, and tight bases through daily and weekly structure." variant="hero" />
      <MorningCommandCenter />
      <ScannerDashboard />
    </>
  );
}
