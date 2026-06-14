"use client";

import {
  ArrowSquareOut,
  Brain,
  Briefcase,
  Buildings,
  ChartLineUp,
  CheckCircle,
  MagnifyingGlass,
  PaperPlaneTilt,
  SpinnerGap,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DueDiligencePillar, DueDiligenceResult } from "@/types/domain";

type ReportResponse =
  | { ok: true; data: DueDiligenceResult }
  | { ok: false; error: { message: string } };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const pillarIcons = {
  financials: ChartLineUp,
  outlook: TrendUp,
  contracts: Briefcase,
  sector: Buildings,
};

function PillarCard({ pillar }: { pillar: DueDiligencePillar }) {
  const Icon = pillarIcons[pillar.id];
  return (
    <article className="rounded-2xl border bg-background/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl border bg-background/55 text-primary">
          <Icon size={18} weight="duotone" />
        </span>
        <div>
          <p className="text-sm font-semibold">{pillar.label}</p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {pillar.weight}% model weight
          </p>
        </div>
        {pillar.score === null ? (
          <span className="ml-auto rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">N/A</span>
        ) : (
          <ScoreBadge score={pillar.score} className="ml-auto" />
        )}
      </div>
      <p className="mt-4 text-sm leading-6">{pillar.summary}</p>
      <div className="mt-4 space-y-2 border-t pt-4">
        {pillar.evidence.map((evidence) => (
          <p key={evidence} className="flex gap-2 text-xs leading-5 text-muted-foreground">
            <CheckCircle className="mt-0.5 shrink-0 text-primary" size={14} weight="fill" />
            {evidence}
          </p>
        ))}
      </div>
    </article>
  );
}

function DueDiligenceCoach({ result }: { result: DueDiligenceResult }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const requestMessages = [...messages, userMessage];
    setMessages([...requestMessages, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/due-diligence/${encodeURIComponent(result.ticker)}/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The local due-diligence coach did not respond.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const content = decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, content: message.content + content } : message,
        ));
      }
    } catch (reason) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(reason instanceof Error ? reason.message : "The local due-diligence coach did not respond.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex min-h-[620px] flex-col overflow-hidden">
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <Brain className="text-primary" size={20} weight="fill" />
          <h3 className="font-semibold">Challenge the {result.ticker} thesis</h3>
          <span className="ml-auto rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Local Gemma</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          The coach receives this report only. Ask it to test assumptions, explain a metric, or identify missing evidence.
        </p>
      </div>
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5">
          {!messages.length ? (
            <ConversationEmptyState
              icon={<Brain size={28} />}
              title="Interrogate the bull case"
              description="Start with the strongest claim, then ask what evidence could disprove it."
            />
          ) : messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageResponse isAnimating={busy && message.role === "assistant"}>
                  {message.content || "Thinking..."}
                </MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {error && <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">{error}</div>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            "What is the strongest evidence for the bull case?",
            "What could invalidate this long-term thesis?",
            "Which missing facts should I verify next?",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={`Ask about ${result.ticker}'s long-term case...`}
            className="min-h-20 flex-1 resize-none rounded-xl border bg-background/55 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <Button size="icon-lg" className="self-end" onClick={submit} disabled={!input.trim() || busy} aria-label="Ask due-diligence coach">
            {busy ? <Brain className="animate-pulse" /> : <PaperPlaneTilt />}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function DueDiligenceView() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<DueDiligenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/due-diligence/${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const payload = await response.json() as ReportResponse;
      if (!payload.ok) throw new Error(payload.error.message);
      setTicker(payload.data.ticker);
      setResult(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Due-diligence research failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel p-5 md:p-7">
        <div className="grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Research workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start with the symbol. Build the case from evidence.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Stocks receive company financial scoring. ETFs and indices are normalized around outlook, catalysts, and market-relative evidence.
            </p>
          </div>
          <div>
            <label htmlFor="due-diligence-ticker" className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Stock, ETF, or index ticker
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                id="due-diligence-ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase().slice(0, 12))}
                placeholder="AAPL, SPY, or ^GSPC"
                autoComplete="off"
                className="h-12 font-mono text-base uppercase"
              />
              <Button className="h-12 px-5 active:scale-[0.98]" disabled={!ticker.trim() || busy}>
                {busy ? <SpinnerGap className="animate-spin" /> : <MagnifyingGlass weight="bold" />}
                {busy ? "Building report" : "Research"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {busy && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="panel h-44 animate-pulse bg-muted/35" />)}
        </div>
      )}
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {result && (
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-3xl font-semibold">{result.ticker}</h2>
                  <ScoreBadge score={result.overallScore} />
                  <StatusBadge label={result.grade} />
                  <span className="rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{result.instrumentType}</span>
                </div>
                <p className="mt-2 text-lg font-medium">{result.company}</p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{result.businessSummary}</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border bg-background/35 px-3 py-1.5">{result.sector}</span>
                  <span className="rounded-full border bg-background/35 px-3 py-1.5">{result.industry}</span>
                  {result.website && (
                    <a href={result.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border bg-background/35 px-3 py-1.5 text-primary hover:border-primary/40">
                      Company website <ArrowSquareOut />
                    </a>
                  )}
                </div>
              </div>
              <div className="border-t bg-background/25 p-6 lg:border-l lg:border-t-0 md:p-8">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Long-term evidence score</p>
                <p className="metric-number mt-3 text-6xl font-semibold tracking-tighter">{result.overallScore}</p>
                <p className="mt-3 text-sm leading-6">{result.verdict}</p>
                <p className="mt-6 text-[10px] leading-5 text-muted-foreground">
                  Generated {new Date(result.researchedAt).toLocaleString()} from {result.provider}. Missing pillars are excluded from the denominator.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {result.pillars.map((pillar) => <PillarCard key={pillar.id} pillar={pillar} />)}
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b p-5">
              <h3 className="font-semibold">Financial and outlook evidence</h3>
              <p className="mt-1 text-xs text-muted-foreground">Reported values and consensus estimates are labeled separately in their explanations.</p>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {result.metrics.map((item) => (
                <div key={item.label} className="border-b p-5 sm:border-r xl:[&:nth-child(4n)]:border-r-0">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="metric-number mt-2 text-xl font-semibold">{item.display}</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.interpretation}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="panel p-5">
              <div className="flex items-center gap-2 text-positive"><CheckCircle weight="fill" /><h3 className="font-semibold text-foreground">Bull-case evidence</h3></div>
              <div className="mt-4 space-y-3">
                {result.bullCase.map((item) => <p key={item} className="border-t pt-3 text-sm leading-6 first:border-t-0 first:pt-0">{item}</p>)}
              </div>
            </div>
            <div className="panel p-5">
              <div className="flex items-center gap-2 text-warning"><WarningCircle weight="fill" /><h3 className="font-semibold text-foreground">Risks and missing proof</h3></div>
              <div className="mt-4 space-y-3">
                {result.risks.map((item) => <p key={item} className="border-t pt-3 text-sm leading-6 first:border-t-0 first:pt-0">{item}</p>)}
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b p-5">
              <h3 className="font-semibold">Contracts, catalysts, and current coverage</h3>
              <p className="mt-1 text-xs text-muted-foreground">Highlighted items contain contract, award, order, partnership, or agreement language. Open the source to verify the underlying claim.</p>
            </div>
            {result.news.length ? (
              <div className="divide-y">
                {result.news.map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="group flex gap-4 p-4 transition hover:bg-accent/30">
                    <span className={cn("mt-1 size-2 shrink-0 rounded-full", item.isContractSignal ? "bg-primary" : "bg-muted-foreground/35")} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-5 group-hover:text-primary">{item.title}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{item.publisher} · {new Date(item.publishedAt).toLocaleDateString()}</span>
                    </span>
                    <ArrowSquareOut className="ml-auto shrink-0 text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}
              </div>
            ) : <p className="p-5 text-sm text-muted-foreground">No relevant coverage was returned.</p>}
          </section>

          <DueDiligenceCoach result={result} />

          <div className="space-y-1 text-[10px] leading-5 text-muted-foreground">
            {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
