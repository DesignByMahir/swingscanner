"use client";

import { CalendarDots, GlobeHemisphereWest, Lightbulb, Newspaper, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import type { DailyReminder, MarketIntelligence } from "@/types/domain";
import { defaultCommandCenterSettings, readCommandCenterSettings, type CommandCenterSettings } from "@/lib/command-center-settings";
import { cn } from "@/lib/utils";

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function MorningCommandCenter() {
  const [market, setMarket] = useState<MarketIntelligence | null>(null);
  const [reminder, setReminder] = useState<DailyReminder | null>(null);
  const [settings, setSettings] = useState<CommandCenterSettings>(defaultCommandCenterSettings);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next = readCommandCenterSettings()) => {
    setSettings(next);
    try {
      const [marketResponse, reminderResponse] = await Promise.all([
        fetch("/api/market-intelligence", { cache: "no-store" }),
        fetch(`/api/journal/reminder?scope=${next.reminderScope}`, { cache: "no-store" }),
      ]);
      const marketPayload = await marketResponse.json() as { ok: boolean; data?: MarketIntelligence; error?: { message: string } };
      const reminderPayload = await reminderResponse.json() as { ok: boolean; data?: DailyReminder };
      if (marketPayload.ok && marketPayload.data) setMarket(marketPayload.data);
      else setError(marketPayload.error?.message ?? "Market intelligence is temporarily unavailable.");
      if (reminderPayload.ok && reminderPayload.data) setReminder(reminderPayload.data);
    } catch {
      setError("Market intelligence is temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    const listener = (event: Event) => void load((event as CustomEvent<CommandCenterSettings>).detail);
    window.addEventListener("swingscanner-command-center-settings", listener);
    window.addEventListener("swingscanner-reflections-updated", () => void load());
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("swingscanner-command-center-settings", listener);
    };
  }, [load]);

  if (!settings.marketState && !settings.reminder && !settings.news) return null;
  const state = market?.marketState;
  const news = market?.news.slice(0, 4) ?? [];

  return (
    <section className="mb-5 space-y-3" aria-label="Morning market intelligence">
      {settings.marketState && (
        <div className="panel grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <GlobeHemisphereWest className="text-primary" weight="fill" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Market State</span>
              {state && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", state.bias === "Bullish" ? "border-positive/35 text-positive" : state.bias === "Bearish" ? "border-negative/35 text-negative" : "border-warning/35 text-warning")}>{state.bias}</span>}
            </div>
            {state ? (
              <>
                <p className="mt-3 text-sm font-medium leading-6">{state.summary}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
                  <span>SPY: {state.spyTrend}</span><span>QQQ: {state.qqqTrend}</span><span>{state.riskContext}</span>
                </div>
                {!!state.leadingSectors.length && <p className="mt-2 text-xs text-muted-foreground">Leadership: {state.leadingSectors.join(", ")}</p>}
              </>
            ) : <p className="mt-3 text-sm text-muted-foreground">{error ?? "Loading real market state..."}</p>}
          </div>
          <div className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="flex items-center gap-2"><CalendarDots className="text-primary" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Upcoming high impact</span></div>
            {market?.upcomingEvents.length ? market.upcomingEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="truncate">{event.title}</span>
                <time className="shrink-0 font-mono text-[10px] text-warning">{new Date(event.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
              </div>
            )) : <p className="mt-3 text-xs text-muted-foreground">No high-impact BLS releases found in the next 21 days.</p>}
          </div>
        </div>
      )}

      {settings.reminder && (
        <div className="panel flex gap-3 p-4">
          <Lightbulb className="mt-0.5 shrink-0 text-warning" size={20} weight="fill" />
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Today&apos;s Reminder</p><p className="mt-2 text-sm font-medium leading-6">{reminder?.message ?? "Wait for confirmation. Clean level, clean volume, clean close."}</p></div>
        </div>
      )}

      {settings.news && (
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3"><Newspaper className="text-primary" weight="fill" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Market News</span><span className="ml-auto text-[10px] text-muted-foreground">{market?.source ?? "Live provider"}</span></div>
          {news.length ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-4">
              {news.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="border-b border-r p-4 hover:bg-secondary/35"><div className="flex justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground"><span>{item.context}</span><span>{relativeTime(item.publishedAt)}</span></div><p className="mt-2 line-clamp-3 text-xs font-medium leading-5">{item.title}</p><p className="mt-2 text-[10px] text-muted-foreground">{item.publisher}</p></a>)}
            </div>
          ) : <div className="flex gap-3 p-4 text-sm text-muted-foreground"><WarningCircle className="shrink-0 text-warning" />{error ?? "No current headlines were returned by the configured public news provider."}</div>}
        </div>
      )}
    </section>
  );
}
