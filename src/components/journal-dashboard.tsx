"use client";

import {
  ArrowDown,
  ArrowUp,
  Brain,
  CheckCircle,
  PaperPlaneTilt,
  Plus,
  NotePencil,
  Trash,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { calculateJournalStats, tradePnl, tradeRMultiple } from "@/lib/journal-analytics";
import { cn } from "@/lib/utils";
import type { DailyReflection, JournalTrade, TradeDirection, TradeStatus } from "@/types/domain";
import { useSwingAccount } from "@/components/account-provider";

type TradeDraft = Omit<JournalTrade, "id" | "createdAt" | "updatedAt" | "tags"> & { tags: string };

function newDraft(): TradeDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    symbol: "",
    direction: "Long",
    status: "Closed",
    setup: "",
    openedAt: today,
    closedAt: today,
    quantity: 0,
    entryPrice: 0,
    exitPrice: 0,
    stopPrice: 0,
    fees: 0,
    confidence: 3,
    followedPlan: true,
    emotionBefore: "",
    emotionAfter: "",
    thesis: "",
    mistakes: "",
    lessons: "",
    tags: "",
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("metric-number mt-2 text-2xl font-semibold", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TradeForm({ onSave }: { onSave: (trade: JournalTrade) => void }) {
  const [draft, setDraft] = useState(newDraft);
  const update = <K extends keyof TradeDraft>(key: K, value: TradeDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    if (!draft.symbol.trim() || !draft.openedAt || draft.quantity <= 0 || draft.entryPrice <= 0) return;
    const now = new Date().toISOString();
    onSave({
      ...draft,
      id: crypto.randomUUID(),
      symbol: draft.symbol.trim().toUpperCase(),
      setup: draft.setup.trim() || "Unclassified",
      closedAt: draft.status === "Closed" ? draft.closedAt : "",
      exitPrice: draft.status === "Closed" ? draft.exitPrice : 0,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      createdAt: now,
      updatedAt: now,
    });
    setDraft(newDraft());
  };

  const numericFields: Array<{ key: "quantity" | "entryPrice" | "exitPrice" | "stopPrice" | "fees"; label: string; disabled?: boolean }> = [
    { key: "quantity", label: "Shares" },
    { key: "entryPrice", label: "Entry price" },
    { key: "exitPrice", label: "Exit price", disabled: draft.status === "Open" },
    { key: "stopPrice", label: "Initial stop" },
    { key: "fees", label: "Fees" },
  ];

  return (
    <div className="grid gap-5 py-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="journal-symbol">Ticker</Label><Input id="journal-symbol" className="mt-2 uppercase" placeholder="NVDA" value={draft.symbol} onChange={(event) => update("symbol", event.target.value)} /></div>
        <div><Label htmlFor="journal-setup">Setup</Label><Input id="journal-setup" className="mt-2" placeholder="BB Squeeze or 8 EMA Base" value={draft.setup} onChange={(event) => update("setup", event.target.value)} /></div>
        <div>
          <Label>Direction</Label>
          <Select value={draft.direction} onValueChange={(value) => update("direction", value as TradeDirection)}>
            <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Long">Long</SelectItem><SelectItem value="Short">Short</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={draft.status} onValueChange={(value) => update("status", value as TradeStatus)}>
            <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Closed">Closed</SelectItem><SelectItem value="Open">Open</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="journal-opened">Opened</Label><Input id="journal-opened" className="mt-2" type="date" value={draft.openedAt} onChange={(event) => update("openedAt", event.target.value)} /></div>
        <div><Label htmlFor="journal-closed">Closed</Label><Input id="journal-closed" className="mt-2" type="date" disabled={draft.status === "Open"} value={draft.closedAt} onChange={(event) => update("closedAt", event.target.value)} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {numericFields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`journal-${field.key}`}>{field.label}</Label>
            <Input id={`journal-${field.key}`} className="metric-number mt-2" type="number" min="0" step="any" disabled={field.disabled} value={draft[field.key]} onChange={(event) => update(field.key, Number(event.target.value))} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Pre-trade confidence</Label>
          <Select value={String(draft.confidence)} onValueChange={(value) => update("confidence", Number(value))}>
            <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5].map((value) => <SelectItem value={String(value)} key={value}>{value} / 5</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div><Label htmlFor="followed-plan">Followed the plan</Label><p className="mt-1 text-xs text-muted-foreground">Grade execution separately from P&L.</p></div>
          <Switch id="followed-plan" checked={draft.followedPlan} onCheckedChange={(value) => update("followedPlan", value)} />
        </div>
      </div>
      {[
        ["thesis", "Plan and thesis", "What had to happen for this trade to work?"],
        ["emotionBefore", "Emotion before entry", "Calm, rushed, fearful, bored, confident..."],
        ["emotionAfter", "Emotion after exit", "What changed after the result?"],
        ["mistakes", "Mistakes", "What was avoidable or outside your rules?"],
        ["lessons", "Lesson to carry forward", "Write one behavior you can repeat or change."],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <Label htmlFor={`journal-${key}`}>{label}</Label>
          <textarea id={`journal-${key}`} className="mt-2 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder={placeholder} value={draft[key as keyof TradeDraft] as string} onChange={(event) => update(key as keyof TradeDraft, event.target.value as never)} />
        </div>
      ))}
      <div><Label htmlFor="journal-tags">Tags</Label><Input id="journal-tags" className="mt-2" placeholder="FOMO, earnings, A+, oversized" value={draft.tags} onChange={(event) => update("tags", event.target.value)} /></div>
      <Button className="w-full" onClick={save} disabled={!draft.symbol.trim() || draft.quantity <= 0 || draft.entryPrice <= 0 || (draft.status === "Closed" && draft.exitPrice <= 0)}>
        <CheckCircle /> Save trade
      </Button>
    </div>
  );
}

function Coach({ trades }: { trades: JournalTrade[] }) {
  type CoachMessage = { id: string; role: "user" | "assistant"; content: string };
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/journal/coach/status", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { ok: boolean }) => setReady(payload.ok))
      .catch(() => setReady(false));
    return () => controller.abort();
  }, []);

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMessage: CoachMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const requestMessages = [...messages, userMessage];
    setMessages([...requestMessages, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/journal/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The local coach did not respond.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const content = decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + content } : message));
      }
      setReady(true);
    } catch (reason) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(reason instanceof Error ? reason.message : "The local coach did not respond.");
      setReady(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel flex h-[min(720px,78dvh)] min-h-[520px] flex-col overflow-hidden">
      <div className="border-b p-5">
        <div className="flex items-center gap-2"><Brain className="text-primary" size={20} weight="fill" /><p className="font-medium">Local reflection coach</p><span className={cn("ml-auto rounded-full border px-2 py-0.5 font-mono text-[9px]", ready ? "border-positive/30 text-positive" : "border-warning/30 text-warning")}>{ready === null ? "CHECKING" : ready ? "GEMMA READY" : "OFFLINE"}</span></div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Gemma runs from the D: drive through local Ollama. Journal content stays on this machine.</p>
      </div>
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5">
          {!messages.length ? (
            <ConversationEmptyState
              icon={<Brain size={28} />}
              title="Start with the decision, not the outcome"
              description={trades.length ? "Ask what your journal says about discipline, emotions, or repeated mistakes." : "Add a trade first so the coach has evidence to work with."}
            />
          ) : messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageResponse isAnimating={busy && message.role === "assistant"}>{message.content || "Thinking..."}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {error && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
              <p className="font-medium">Local coach is offline.</p>
              <p className="mt-1 text-muted-foreground">{error} Start SwingScanner with the D: launcher so Ollama starts first.</p>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {["What pattern is costing me most?", "Separate luck from execution.", "Give me one process experiment."].map((prompt) => (
            <button key={prompt} onClick={() => setInput(prompt)} className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">{prompt}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about a trade, habit, emotion, or lesson..."
            className="min-h-20 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <Button size="icon-lg" className="self-end" onClick={submit} disabled={!input.trim() || busy || !trades.length} aria-label="Send to reflection coach">
            {busy ? <Brain className="animate-pulse" /> : <PaperPlaneTilt />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function JournalDashboard() {
  const account = useSwingAccount();
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [reflectionDate, setReflectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyNotes, setDailyNotes] = useState("");
  const [endOfDayReflection, setEndOfDayReflection] = useState("");
  const [nextDayLesson, setNextDayLesson] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cloudHydratedFor, setCloudHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/journal/trades", { cache: "no-store", signal: controller.signal }).then((response) => response.json()) as Promise<{ ok: boolean; data?: JournalTrade[] }>,
      fetch("/api/journal/reflections", { cache: "no-store", signal: controller.signal }).then((response) => response.json()) as Promise<{ ok: boolean; data?: DailyReflection[] }>,
    ])
      .then(([tradePayload, reflectionPayload]) => {
        setTrades(tradePayload.ok && tradePayload.data ? tradePayload.data : []);
        setReflections(reflectionPayload.ok && reflectionPayload.data ? reflectionPayload.data : []);
      })
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!loaded || !account.userId || !account.stateLoaded || cloudHydratedFor === account.userId) return;
    const timer = window.setTimeout(() => {
      if (account.cloud.journal.length) setTrades(account.cloud.journal);
      else if (trades.length) void account.saveJournal(trades);
      if (account.cloud.reflections.length) setReflections(account.cloud.reflections);
      else if (reflections.length) void account.saveReflections(reflections);
      setCloudHydratedFor(account.userId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [account, cloudHydratedFor, loaded, reflections, trades]);

  const persist = async (next: JournalTrade[]) => {
    const previous = trades;
    setTrades(next);
    const response = await fetch("/api/journal/trades", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) setTrades(previous);
    else if (account.userId) await account.saveJournal(next);
  };
  const addTrade = (trade: JournalTrade) => {
    void persist([trade, ...trades]);
    setDialogOpen(false);
  };
  const removeTrade = (id: string) => void persist(trades.filter((trade) => trade.id !== id));
  const saveReflection = async () => {
    const now = new Date().toISOString();
    const existing = reflections.find((item) => item.tradingDate === reflectionDate);
    const reflection: DailyReflection = {
      id: existing?.id ?? crypto.randomUUID(),
      tradingDate: reflectionDate,
      notes: dailyNotes.trim(),
      endOfDayReflection: endOfDayReflection.trim(),
      nextDayLesson: nextDayLesson.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = [reflection, ...reflections.filter((item) => item.tradingDate !== reflectionDate)]
      .sort((a, b) => b.tradingDate.localeCompare(a.tradingDate));
    const response = await fetch("/api/journal/reflections", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (response.ok) {
      setReflections(next);
      if (account.userId) await account.saveReflections(next);
      window.dispatchEvent(new Event("swingscanner-reflections-updated"));
    }
  };
  const stats = useMemo(() => calculateJournalStats(trades), [trades]);

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><NotePencil className="text-primary" weight="fill" /><p className="font-medium">Daily reflection</p></div><p className="mt-1 text-xs text-muted-foreground">Capture the day’s execution lesson and the rule you want surfaced tomorrow.</p></div>
          <Input type="date" className="w-auto" value={reflectionDate} onChange={(event) => {
            const date = event.target.value;
            const saved = reflections.find((item) => item.tradingDate === date);
            setReflectionDate(date);
            setDailyNotes(saved?.notes ?? "");
            setEndOfDayReflection(saved?.endOfDayReflection ?? "");
            setNextDayLesson(saved?.nextDayLesson ?? "");
          }} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div><Label htmlFor="daily-notes">Daily notes</Label><textarea id="daily-notes" className="mt-2 min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Fills, patience, market conditions, execution..." value={dailyNotes} onChange={(event) => setDailyNotes(event.target.value)} /></div>
          <div><Label htmlFor="eod-reflection">End-of-day reflection</Label><textarea id="eod-reflection" className="mt-2 min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="What happened, what was avoidable, and what repeated?" value={endOfDayReflection} onChange={(event) => setEndOfDayReflection(event.target.value)} /></div>
          <div><Label htmlFor="next-lesson">Next-day lesson</Label><textarea id="next-lesson" className="mt-2 min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="One direct rule for tomorrow. This becomes the reminder." value={nextDayLesson} onChange={(event) => setNextDayLesson(event.target.value)} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] text-muted-foreground">{reflections.length} daily reflection{reflections.length === 1 ? "" : "s"} saved locally.</p><Button onClick={saveReflection} disabled={!dailyNotes.trim() && !endOfDayReflection.trim() && !nextDayLesson.trim()}><CheckCircle /> Save reflection</Button></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground">Private local storage: journal records are written to the D: drive. The local Gemma model receives a snapshot only when you send a coach message.</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus /> Log trade</Button></DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader><DialogTitle>Log a trade</DialogTitle><DialogDescription>Capture facts first, then grade the process independently of the result.</DialogDescription></DialogHeader>
            <TradeForm onSave={addTrade} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Net P&L" value={money(stats.netPnl)} detail={`${stats.closedTrades} closed trades`} tone={stats.netPnl > 0 ? "positive" : stats.netPnl < 0 ? "negative" : undefined} />
        <StatCard label="Win rate" value={`${number(stats.winRate)}%`} detail={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven} flat`} />
        <StatCard label="Profit factor" value={stats.profitFactor === null ? "Unlimited" : number(stats.profitFactor)} detail="Gross wins / gross losses" />
        <StatCard label="Expectancy" value={money(stats.expectancy)} detail="Average net P&L per trade" tone={stats.expectancy > 0 ? "positive" : stats.expectancy < 0 ? "negative" : undefined} />
        <StatCard label="Average R" value={stats.averageR === null ? "--" : `${number(stats.averageR)}R`} detail="Based on initial stop risk" />
        <StatCard label="Plan adherence" value={`${number(stats.planAdherence)}%`} detail={`${stats.openTrades} currently open`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b p-5">
              <div><p className="font-medium">Trade log</p><p className="mt-1 text-xs text-muted-foreground">Best win streak: {stats.bestWinStreak} | Current streak: {stats.currentStreak > 0 ? `${stats.currentStreak} wins` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)} losses` : "none"}</p></div>
              <span className="metric-number text-xs text-muted-foreground">{stats.totalTrades} records</span>
            </div>
            {!loaded ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading journal...</div>
            ) : !trades.length ? (
              <div className="grid min-h-72 place-items-center p-8 text-center">
                <div><p className="font-medium">No trades logged yet</p><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with your next trade or add a recent one while the reasoning is still fresh.</p><Button className="mt-5" onClick={() => setDialogOpen(true)}><Plus /> Log first trade</Button></div>
              </div>
            ) : (
              <div className="divide-y">
                {trades.map((trade) => {
                  const pnl = tradePnl(trade);
                  const r = tradeRMultiple(trade);
                  return (
                    <article key={trade.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <span className={cn("mt-0.5 grid size-9 place-items-center rounded-lg border", trade.direction === "Long" ? "border-positive/25 bg-positive/10 text-positive" : "border-negative/25 bg-negative/10 text-negative")}>
                            {trade.direction === "Long" ? <ArrowUp /> : <ArrowDown />}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2"><strong className="font-mono">{trade.symbol}</strong><span className="text-xs text-muted-foreground">{trade.setup}</span><span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{trade.status}</span></div>
                            <p className="mt-1 text-xs text-muted-foreground">{trade.openedAt}{trade.closedAt ? ` to ${trade.closedAt}` : ""} | {trade.quantity} shares | {trade.followedPlan ? "Plan followed" : "Plan broken"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className={cn("metric-number font-medium", pnl > 0 && "text-positive", pnl < 0 && "text-negative")}>{trade.status === "Open" ? "Open" : money(pnl)}</p>
                            <p className="metric-number mt-1 text-xs text-muted-foreground">{r === null ? "No R yet" : `${number(r)}R`}</p>
                          </div>
                          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${trade.symbol} trade`} onClick={() => removeTrade(trade.id)}><Trash /></Button>
                        </div>
                      </div>
                      {(trade.lessons || trade.mistakes || trade.thesis) && (
                        <div className="mt-4 grid gap-3 rounded-lg bg-background/60 p-4 text-xs leading-5 sm:grid-cols-3">
                          <div><p className="font-medium text-foreground">Thesis</p><p className="mt-1 text-muted-foreground">{trade.thesis || "Not recorded"}</p></div>
                          <div><p className="font-medium text-foreground">Mistake</p><p className="mt-1 text-muted-foreground">{trade.mistakes || "None recorded"}</p></div>
                          <div><p className="font-medium text-foreground">Lesson</p><p className="mt-1 text-muted-foreground">{trade.lessons || "Not recorded"}</p></div>
                        </div>
                      )}
                      {!!trade.tags.length && <div className="mt-3 flex flex-wrap gap-1.5">{trade.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">#{tag}</span>)}</div>}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel p-5"><div className="flex items-center gap-2 text-positive"><TrendUp weight="bold" /><p className="text-sm font-medium">Average winner</p></div><p className="metric-number mt-3 text-xl">{money(stats.averageWin)}</p></div>
            <div className="panel p-5"><div className="flex items-center gap-2 text-negative"><TrendDown weight="bold" /><p className="text-sm font-medium">Average loser</p></div><p className="metric-number mt-3 text-xl">{money(stats.averageLoss)}</p></div>
          </div>
        </div>
        <Coach trades={trades} />
      </div>
    </div>
  );
}
