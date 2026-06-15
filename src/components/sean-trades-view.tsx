"use client";

import {
  ArrowClockwise,
  ArrowSquareOut,
  ChartLineUp,
  Info,
  NewspaperClipping,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTimeline: (
          source: { sourceType: "profile"; screenName: string },
          element: HTMLElement,
          options: Record<string, string | number>,
        ) => Promise<HTMLElement>;
      };
    };
  }
}

const profileUrl = "https://x.com/SRxTrades";
const setupSearchUrl = "https://x.com/search?q=%28from%3ASRxTrades%29%20%28%24%20OR%20setup%20OR%20breakout%20OR%20long%20OR%20short%20OR%20watching%29&src=typed_query&f=live";

export function SeanTradesView() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshKey, setRefreshKey] = useState(0);

  const renderTimeline = useCallback(async () => {
    const target = timelineRef.current;
    if (!target || !window.twttr?.widgets) return;
    target.replaceChildren();
    setStatus("loading");
    try {
      await Promise.race([
        window.twttr.widgets.createTimeline(
          { sourceType: "profile", screenName: "SRxTrades" },
          target,
          {
            height: 820,
            theme: document.documentElement.dataset.theme === "modern" ? "light" : "dark",
            chrome: "noheader nofooter transparent",
            dnt: "true",
          },
        ),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("X timeline timed out")), 10_000);
        }),
      ]);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://platform.twitter.com/widgets.js"]');
    if (window.twttr?.widgets) {
      const timer = window.setTimeout(() => void renderTimeline(), 0);
      return () => window.clearTimeout(timer);
    }
    const script = existing ?? document.createElement("script");
    const loaded = () => void renderTimeline();
    script.addEventListener("load", loaded);
    script.addEventListener("error", () => setStatus("error"));
    if (!existing) {
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.append(script);
    }
    return () => script.removeEventListener("load", loaded);
  }, [refreshKey, renderTimeline]);

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4 self-start xl:sticky xl:top-8">
        <section className="panel p-5">
          <div className="flex items-center gap-2 text-primary">
            <NewspaperClipping weight="fill" />
            <h2 className="font-semibold">SRxTrades on X</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The feed is rendered by X and refreshes from the public profile. Posts open in your default browser.
          </p>
          <div className="mt-5 grid gap-2">
            <Button asChild>
              <a href={setupSearchUrl} target="_blank" rel="noreferrer">
                <ChartLineUp /> Setup-focused posts <ArrowSquareOut />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={profileUrl} target="_blank" rel="noreferrer">
                All posts on X <ArrowSquareOut />
              </a>
            </Button>
            <Button variant="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
              <ArrowClockwise /> Refresh embedded feed
            </Button>
          </div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center gap-2"><Info className="text-primary" /><p className="text-sm font-semibold">Why two views?</p></div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            X provides a supported free profile timeline, but filtering and classifying individual posts requires X API access. The setup button uses X&apos;s live search so it remains current without an unofficial scraper.
          </p>
        </section>
      </aside>

      <section className="panel min-h-[860px] overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">Latest posts</h2>
            <p className="mt-1 text-xs text-muted-foreground">Official public profile timeline</p>
          </div>
          <span className="rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{status}</span>
        </div>
        <div className="relative min-h-[820px] bg-background/20 p-3">
          {status === "loading" && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"><ArrowClockwise className="mr-2 inline animate-spin" /> Loading X timeline...</div>}
          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div>
                <p className="font-medium">X did not load the embedded timeline.</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">This can happen when X blocks embedded content or the computer is offline.</p>
                <Button asChild className="mt-4"><a href={profileUrl} target="_blank" rel="noreferrer">Open SRxTrades on X <ArrowSquareOut /></a></Button>
              </div>
            </div>
          )}
          <div ref={timelineRef} className="mx-auto max-w-2xl" />
        </div>
      </section>
    </div>
  );
}
