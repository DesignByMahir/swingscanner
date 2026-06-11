"use client";

import { Brain, PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import type { FreeScanResult, StockSetup } from "@/types/domain";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type ScanResponse = { ok: true; data: FreeScanResult } | { ok: false; error: { message: string } };
type SetupResponse =
  | { ok: true; data: { setup: StockSetup } }
  | { ok: false; error: { message: string } };

export function SetupCoachView() {
  const [setups, setSetups] = useState<StockSetup[]>([]);
  const [ticker, setTicker] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/scan/latest", { cache: "no-store" });
        const payload = await response.json() as ScanResponse;
        if (!payload.ok) throw new Error(payload.error.message);
        const requested = new URLSearchParams(window.location.search).get("ticker")?.toUpperCase();
        let available = payload.data.topSetups;
        if (requested && !available.some((setup) => setup.ticker === requested)) {
          const setupResponse = await fetch(
            `/api/setups/${encodeURIComponent(requested)}`,
            { cache: "no-store" },
          );
          const setupPayload = await setupResponse.json().catch(() => null) as SetupResponse | null;
          if (setupPayload?.ok) {
            available = [setupPayload.data.setup, ...available];
          }
        }
        setSetups(available);
        const initial = available.find((setup) => setup.ticker === requested)?.ticker ?? available[0]?.ticker ?? "";
        setTicker(initial);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load the latest setups.");
      }
    })();
  }, []);

  const selected = setups.find((setup) => setup.ticker === ticker);
  const selectTicker = (nextTicker: string) => {
    setTicker(nextTicker);
    setMessages([]);
    setInput("");
    setError(null);
    window.history.replaceState(null, "", `/setup-coach?ticker=${encodeURIComponent(nextTicker)}`);
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || !ticker || busy) return;
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content: text };
    const assistantId = crypto.randomUUID();
    const requestMessages = [...messages, userMessage];
    setMessages([...requestMessages, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/setups/${encodeURIComponent(ticker)}/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: requestMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The local setup analyst did not respond.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const content = decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + content } : message));
      }
    } catch (reason) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(reason instanceof Error ? reason.message : "The local setup analyst did not respond.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="panel self-start p-4">
        <label htmlFor="coach-ticker" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Current setup</label>
        <select id="coach-ticker" value={ticker} onChange={(event) => selectTicker(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3 font-mono text-sm outline-none focus:border-ring">
          {setups.map((setup) => <option key={setup.ticker} value={setup.ticker}>{setup.ticker} · {setup.setup}</option>)}
        </select>
        {selected && (
          <div className="mt-4 space-y-3 rounded-lg border bg-background/50 p-4">
            <div><p className="font-mono text-xl font-semibold">{selected.ticker}</p><p className="mt-1 text-xs text-muted-foreground">{selected.company}</p></div>
            <div className="grid grid-cols-2 gap-2 text-xs"><span>Score {selected.finalScore}</span><span>{selected.grade}</span><span>RSI {selected.rsi.toFixed(1)}</span><span>Tightening {(selected.tighteningPercent ?? selected.plan.tighteningPercent ?? 0).toFixed(0)}%</span></div>
            <p className="text-xs leading-5 text-muted-foreground">{selected.plan.trigger}</p>
            <Button asChild variant="outline" size="sm" className="w-full"><Link href={`/setups/${selected.ticker}`}>View chart and thesis</Link></Button>
          </div>
        )}
      </aside>
      <div className="panel flex min-h-[680px] flex-col overflow-hidden">
        <div className="border-b p-5">
          <div className="flex items-center gap-2"><Brain className="text-primary" weight="fill" /><p className="font-medium">{ticker ? `Ask about ${ticker}` : "Loading setups..."}</p></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Gemma answers locally from the selected setup&apos;s completed scan, chart history, and written trade plan.</p>
        </div>
        <Conversation className="min-h-0">
          <ConversationContent className="gap-5">
            {!messages.length ? <ConversationEmptyState icon={<Brain size={28} />} title="Interrogate the setup" description="Ask what confirms it, what weakens it, or how its trigger and invalidation relate." /> : messages.map((message) => (
              <Message from={message.role} key={message.id}><MessageContent><MessageResponse isAnimating={busy && message.role === "assistant"}>{message.content || "Thinking..."}</MessageResponse></MessageContent></Message>
            ))}
            {error && <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{error}</div>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="border-t p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {["What confirms the daily breakout?", "What are the main risks?", "Explain the base, entry, and stop."].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)} className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">{prompt}</button>)}
          </div>
          <div className="flex gap-2">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder={ticker ? `Ask about ${ticker}...` : "Loading setups..."} disabled={!ticker} className="min-h-20 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
            <Button size="icon-lg" className="self-end" onClick={submit} disabled={!input.trim() || !ticker || busy} aria-label="Ask setup analyst">{busy ? <Brain className="animate-pulse" /> : <PaperPlaneTilt />}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
