import { PageHeader } from "@/components/shared";
import { ScannerDashboard } from "@/components/scanner-dashboard";
import { MorningCommandCenter } from "@/components/morning-command-center";

export const metadata = { title: "Setup Scanner" };

export default function ScannerPage() {
  return (
    <>
      <PageHeader eyebrow="Options-first completed candles" title="Morning setup scanner" description="The local engine finds bases, bull flags, wedge pops, squeezes, and breakout consolidations, then ranks them through sector leadership, horizontal resistance quality, and real options tradability." variant="hero" />
      <MorningCommandCenter />
      <ScannerDashboard />
    </>
  );
}
