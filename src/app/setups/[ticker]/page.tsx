import { notFound } from "next/navigation";
import { SetupDetailView } from "@/components/setup-detail-view";
import { getSetupDetail } from "@/lib/setup-detail";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = (await params).ticker.toUpperCase();
  return { title: `${ticker} Setup` };
}

export default async function SetupPage({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = (await params).ticker.toUpperCase();
  const detail = await getSetupDetail(ticker);
  if (!detail) notFound();
  return <SetupDetailView detail={detail} />;
}
