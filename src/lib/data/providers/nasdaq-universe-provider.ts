import type { UniverseSymbol } from "@/types/domain";

const NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt";
const OTHER_URL = "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt";

function isUnsupportedSecurity(symbol: string, name: string) {
  const upper = name.toUpperCase();
  return (
    !/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(symbol) ||
    /WARRANT|RIGHTS?|UNITS?|PREFERRED|PFD|DEPOSITARY SHARES|ACQUISITION CORP|NEXTSHARES/.test(upper) ||
    /[WURP]$/.test(symbol)
  );
}

function parseFile(text: string, source: "nasdaq" | "other"): UniverseSymbol[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split("|");
  return lines.slice(1).flatMap((line) => {
    const values = line.split("|");
    if (values.length !== headers.length || line.startsWith("File Creation Time")) return [];
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
    const symbol = source === "nasdaq" ? row.Symbol : row["ACT Symbol"];
    const name = row["Security Name"];
    const isETF = row.ETF === "Y";
    const isTestIssue = row["Test Issue"] === "Y";
    const financialStatus = row["Financial Status"];
    if (!symbol || !name || isETF || isTestIssue || financialStatus === "D" || isUnsupportedSecurity(symbol, name)) return [];
    return [{
      symbol,
      name: name.replace(/\s+-\s+.+$/, "").trim(),
      exchange: source === "nasdaq" ? "NASDAQ" : ({ A: "NYSE American", N: "NYSE", P: "NYSE Arca", Z: "Cboe BZX", V: "IEX" }[row.Exchange] ?? row.Exchange),
      isETF,
      isTestIssue,
      source: "nasdaqtrader" as const,
    }];
  });
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "SwingScanner/1.0 market-research" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`NasdaqTrader returned ${response.status}`);
  return response.text();
}

export async function getNasdaqUniverse(): Promise<UniverseSymbol[]> {
  const [nasdaq, other] = await Promise.all([fetchText(NASDAQ_URL), fetchText(OTHER_URL)]);
  const combined = [...parseFile(nasdaq, "nasdaq"), ...parseFile(other, "other")];
  return [...new Map(combined.map((item) => [item.symbol, item])).values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}
