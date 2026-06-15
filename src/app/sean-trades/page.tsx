import { PageHeader } from "@/components/shared";
import { SeanTradesView } from "@/components/sean-trades-view";

export const metadata = { title: "SeanTrades" };

export default function SeanTradesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Mentor feed"
        title="SeanTrades"
        description="Follow SRxTrades directly through X's official public timeline, then jump into a setup-focused live search when you want only chart calls and trade ideas."
        variant="hero"
      />
      <SeanTradesView />
    </>
  );
}
