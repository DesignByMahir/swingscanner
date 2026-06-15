"use client";

import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  Brain,
  Crosshair,
  DownloadSimple,
  ImageSquare,
  Minus,
  Path,
  SpinnerGap,
  Target,
  Trash,
  TrendUp,
  UploadSimple,
} from "@phosphor-icons/react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "cursor" | "path" | "horizontal" | "trend" | "risk" | "long" | "short";
type Point = { x: number; y: number };
type Drawing =
  | { id: string; tool: "path"; points: Point[] }
  | { id: string; tool: Exclude<Tool, "cursor" | "path">; p1: Point; p2: Point };

const width = 1000;
const height = 620;
const tools: Array<{ id: Tool; label: string; icon: typeof Crosshair }> = [
  { id: "cursor", label: "Cursor", icon: Crosshair },
  { id: "path", label: "Path", icon: Path },
  { id: "horizontal", label: "Horizontal line", icon: Minus },
  { id: "trend", label: "Trend line", icon: TrendUp },
  { id: "risk", label: "Take profit / stop", icon: Target },
  { id: "long", label: "Long position", icon: ArrowUp },
  { id: "short", label: "Short position", icon: ArrowDown },
];

function drawingMarkup(drawing: Drawing, preview = false) {
  const stroke = preview ? "var(--primary)" : "var(--chart-drawing)";
  if (drawing.tool === "path") {
    return (
      <polyline
        points={drawing.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={preview ? 0.75 : 1}
      />
    );
  }
  if (drawing.tool === "horizontal") {
    return <line x1={0} y1={drawing.p2.y} x2={width} y2={drawing.p2.y} stroke={stroke} strokeWidth="2" />;
  }
  if (drawing.tool === "trend") {
    return <line x1={drawing.p1.x} y1={drawing.p1.y} x2={drawing.p2.x} y2={drawing.p2.y} stroke={stroke} strokeWidth="2.5" />;
  }

  const entry = drawing.p1.y;
  const drag = drawing.p2.y;
  const target = drawing.tool === "long"
    ? entry - Math.abs(drag - entry)
    : drawing.tool === "short"
      ? entry + Math.abs(drag - entry)
      : Math.min(entry, drag);
  const stop = drawing.tool === "long"
    ? entry + Math.abs(drag - entry)
    : drawing.tool === "short"
      ? entry - Math.abs(drag - entry)
      : Math.max(entry, drag);
  const x1 = Math.min(drawing.p1.x, drawing.p2.x);
  const x2 = Math.max(drawing.p1.x, drawing.p2.x);
  const profitTop = Math.min(entry, target);
  const lossTop = Math.min(entry, stop);
  return (
    <g opacity={preview ? 0.72 : 0.92}>
      <rect x={x1} y={profitTop} width={Math.max(8, x2 - x1)} height={Math.max(1, Math.abs(entry - target))} fill="var(--positive)" opacity="0.22" />
      <rect x={x1} y={lossTop} width={Math.max(8, x2 - x1)} height={Math.max(1, Math.abs(stop - entry))} fill="var(--negative)" opacity="0.24" />
      <line x1={x1} y1={entry} x2={x2} y2={entry} stroke={stroke} strokeWidth="2" strokeDasharray="6 4" />
      <line x1={x1} y1={target} x2={x2} y2={target} stroke="var(--positive)" strokeWidth="2" />
      <line x1={x1} y1={stop} x2={x2} y2={stop} stroke="var(--negative)" strokeWidth="2" />
      <text x={x2 + 6} y={target + 4} fill="var(--positive)" fontSize="11" fontFamily="monospace">TP</text>
      <text x={x2 + 6} y={stop + 4} fill="var(--negative)" fontSize="11" fontFamily="monospace">SL</text>
    </g>
  );
}

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
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [active, setActive] = useState<Drawing | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
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
    setDrawings([]);
    setImage(await resizeImage(file));
  };

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
      y: Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)),
    };
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!image || tool === "cursor") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setActive(tool === "path"
      ? { id: crypto.randomUUID(), tool, points: [point] }
      : { id: crypto.randomUUID(), tool, p1: point, p2: point });
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    setCursor(point);
    if (!active) return;
    if (active.tool === "path") {
      const previous = active.points.at(-1)!;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 3) {
        setActive({ ...active, points: [...active.points, point] });
      }
    } else {
      setActive({ ...active, p2: point });
    }
  };

  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const valid = active.tool === "path"
      ? active.points.length > 1
      : Math.hypot(active.p2.x - active.p1.x, active.p2.y - active.p1.y) > 3 ||
        active.tool === "horizontal";
    if (valid) setDrawings((current) => [...current, active]);
    setActive(null);
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

  const download = () => {
    if (!image) return;
    const svg = document.querySelector("#screenshot-analysis-canvas");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SwingScanner-annotated-chart.svg";
    link.click();
    URL.revokeObjectURL(url);
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
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              {tools.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  size="sm"
                  variant={tool === id ? "default" : "outline"}
                  title={label}
                  onClick={() => { setTool(id); setActive(null); }}
                >
                  <Icon /> <span className="hidden xl:inline">{label}</span>
                </Button>
              ))}
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{drawings.length} drawings</span>
              <Button size="sm" variant="ghost" disabled={!drawings.length} onClick={() => setDrawings((current) => current.slice(0, -1))}><ArrowCounterClockwise /> Undo</Button>
              <Button size="sm" variant="ghost" disabled={!drawings.length} onClick={() => setDrawings([])}><Trash /> Clear</Button>
              <Button size="sm" variant="outline" onClick={download}><DownloadSimple /> Export</Button>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><UploadSimple /> Replace</Button>
            </div>
            <div className="overflow-x-auto bg-[var(--chart-bg)]">
              <svg
                id="screenshot-analysis-canvas"
                viewBox={`0 0 ${width} ${height}`}
                className={cn("w-full min-w-[760px] touch-none select-none", tool !== "cursor" && "cursor-crosshair")}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerLeave={() => { setCursor(null); if (active) setActive(null); }}
              >
                <image href={image} x="0" y="0" width={width} height={height} preserveAspectRatio="xMidYMid meet" />
                <rect width={width} height={height} fill="transparent" />
                {drawings.map((drawing) => <g key={drawing.id}>{drawingMarkup(drawing)}</g>)}
                {active && drawingMarkup(active, true)}
                {cursor && tool !== "cursor" && (
                  <g pointerEvents="none" opacity="0.7">
                    <line x1={0} y1={cursor.y} x2={width} y2={cursor.y} stroke="var(--chart-drawing)" strokeWidth="1" strokeDasharray="3 5" />
                    <line x1={cursor.x} y1={0} x2={cursor.x} y2={height} stroke="var(--chart-drawing)" strokeWidth="1" strokeDasharray="3 5" />
                    <line x1={cursor.x - 9} y1={cursor.y} x2={cursor.x + 9} y2={cursor.y} stroke="var(--chart-drawing)" strokeWidth="2" />
                    <line x1={cursor.x} y1={cursor.y - 9} x2={cursor.x} y2={cursor.y + 9} stroke="var(--chart-drawing)" strokeWidth="2" />
                  </g>
                )}
              </svg>
            </div>
            <p className="border-t p-3 text-[10px] leading-5 text-muted-foreground">Press and drag to draw. The crosshair and live preview show the mark before it is committed.</p>
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
