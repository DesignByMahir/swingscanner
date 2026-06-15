"use client";

import {
  Brain,
  ImageSquare,
  SpinnerGap,
  UploadSimple,
} from "@phosphor-icons/react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

async function resizeImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = reject;
    next.src = dataUrl;
  });
  const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ScreenshotAnalyzerView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Choose a PNG, JPEG, or WebP screenshot.");
      return;
    }
    setError(null);
    setAnalysis("");
    setImage(await resizeImage(file));
  };

  const analyze = async () => {
    if (!image || busy) return;
    setBusy(true);
    setError(null);
    setAnalysis("");
    try {
      const response = await fetch("/api/screenshot-analyzer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, notes }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The local screenshot analyst did not respond.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local screenshot analyst did not respond.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => void loadFile(event.target.files?.[0])}
      />
      {!image ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            void loadFile(event.dataTransfer.files[0]);
          }}
          className="panel grid min-h-[440px] w-full place-items-center border-dashed p-8 text-center transition hover:border-primary/45 hover:bg-accent/15 active:scale-[0.995]"
        >
          <span>
            <span className="mx-auto grid size-16 place-items-center rounded-2xl border bg-background/40 text-primary"><ImageSquare size={30} weight="duotone" /></span>
            <strong className="mt-5 block text-xl">Drop a TradingView screenshot here</strong>
            <span className="mt-2 block text-sm text-muted-foreground">PNG, JPEG, or WebP. The image remains local unless you ask Ollama to analyze it.</span>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"><UploadSimple /> Choose screenshot</span>
          </span>
        </button>
      ) : (
        <>
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b p-3">
              <div>
                <p className="text-sm font-medium">Uploaded TradingView chart</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Drawing tools remain available on scanned setup charts.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><UploadSimple /> Replace</Button>
            </div>
            <div className="grid max-h-[720px] min-h-[420px] place-items-center overflow-auto bg-[var(--chart-bg)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Uploaded TradingView chart" className="max-h-[690px] max-w-full rounded-lg object-contain" />
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="border-b p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2"><Brain className="text-primary" weight="fill" /><h2 className="font-semibold">Local screenshot analyst</h2></div>
                <label htmlFor="screenshot-notes" className="mt-5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Optional context</label>
                <textarea
                  id="screenshot-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ticker, timeframe, or the setup you think you see..."
                  className="mt-2 min-h-28 w-full resize-none rounded-xl border bg-background/45 p-3 text-sm outline-none focus:border-ring"
                />
                <Button className="mt-3 w-full" onClick={analyze} disabled={busy}>
                  {busy ? <SpinnerGap className="animate-spin" /> : <Brain />}
                  {busy ? "Analyzing screenshot" : "Analyze visible setup"}
                </Button>
                <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Requires an Ollama vision model. Recommended: <span className="font-mono">gemma3:4b</span>.</p>
              </div>
              <div className="flex min-h-[360px] flex-col p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Analysis</p>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border bg-background/35 p-4">
                  {analysis ? <div className="whitespace-pre-wrap text-sm leading-7">{analysis}</div> : <div className="grid h-full min-h-64 place-items-center text-center text-sm text-muted-foreground">The analysis stays inside this scrollable panel.</div>}
                </div>
                {error && <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">{error}</p>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
