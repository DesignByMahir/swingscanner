import { PageHeader } from "@/components/shared";
import { ScreenshotAnalyzerView } from "@/components/screenshot-analyzer-view";

export const metadata = { title: "Screenshot Analyzer" };

export default function ScreenshotAnalyzerPage() {
  return (
    <>
      <PageHeader
        eyebrow="TradingView screenshot review"
        title="Screenshot analyzer"
        description="Upload a TradingView chart and ask the local vision model to evaluate only the setup visible in the screenshot."
        variant="hero"
      />
      <ScreenshotAnalyzerView />
    </>
  );
}
