import type { DailyCandle } from "@/types/domain";

export function toStooqSymbol(symbol: string) {
  return `${symbol.toLowerCase().replaceAll(".", "-")}.us`;
}

export function parseStooqCsv(csv: string): DailyCandle[] | null {
  if (!csv.startsWith("Date,Open,High,Low,Close,Volume")) return null;
  const candles = csv.trim().split(/\r?\n/).slice(1).flatMap((line) => {
    const [date, open, high, low, close, volume] = line.split(",");
    const values = [open, high, low, close, volume].map(Number);
    if (!date || values.some((value) => !Number.isFinite(value)) || values[0] <= 0) return [];
    return [{ date, open: values[0], high: values[1], low: values[2], close: values[3], volume: values[4] }];
  });
  return candles.length >= 60 ? candles : null;
}

export class StooqProvider {
  private challenged = false;
  requests = 0;

  get isChallenged() {
    return this.challenged;
  }

  async getDailyCandles(symbol: string, limit = 250): Promise<DailyCandle[] | null> {
    if (this.challenged) return null;
    const end = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - Math.ceil(limit * 1.7));
    const start = startDate.toISOString().slice(0, 10).replaceAll("-", "");
    const url = `https://stooq.com/q/d/l/?s=${toStooqSymbol(symbol)}&i=d&d1=${start}&d2=${end}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      this.requests += 1;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 SwingScanner/1.0", Accept: "text/csv,text/plain,*/*" },
          signal: AbortSignal.timeout(10_000),
        });
        const text = await response.text();
        const candles = parseStooqCsv(text);
        if (candles) return candles.slice(-limit);
        if (text.includes("requires JavaScript to verify")) {
          this.challenged = true;
          return null;
        }
      } catch {
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    return null;
  }
}
