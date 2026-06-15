import { PageHeader } from "@/components/shared";
import { ScreenshotAnalyzerView } from "@/components/screenshot-analyzer-view";

export const metadata = { title: "Screenshot Analyzer" };

export default function ScreenshotAnalyzerPage() {
  return (
    <>
      <PageHeader
        eyebrow="TradingView screenshot workspace"
        title="Screenshot analyzer"
        description="Upload a chart, mark the structure with TradingView-style tools, and ask the local vision model to evaluate only what is visible."
        variant="hero"
      />
      <ScreenshotAnalyzerView />
    </>
  );
}
