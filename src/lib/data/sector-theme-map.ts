import { withCache } from "./cache";
export { ALL_SECTORS, SECTOR_ETFS, SECTOR_NAMES } from "./sector-catalog";

export interface SectorMetadata {
  sector: string;
  sectorTicker: string;
  theme: string;
  themeSlug: string;
}

interface NasdaqScreenerRow {
  symbol?: string;
  name?: string;
  sector?: string;
  industry?: string;
}

const NASDAQ_SCREENER_URL = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true";

const sectorAliases: Record<string, [string, string]> = {
  "Basic Materials": ["Materials", "XLB"],
  "Communication Services": ["Communication Services", "XLC"],
  "Consumer Discretionary": ["Consumer Discretionary", "XLY"],
  "Consumer Staples": ["Consumer Staples", "XLP"],
  Energy: ["Energy", "XLE"],
  Finance: ["Financials", "XLF"],
  Financials: ["Financials", "XLF"],
  "Health Care": ["Healthcare", "XLV"],
  Healthcare: ["Healthcare", "XLV"],
  Industrials: ["Industrials", "XLI"],
  Materials: ["Materials", "XLB"],
  "Real Estate": ["Real Estate", "XLRE"],
  Technology: ["Technology", "XLK"],
  Telecommunications: ["Communication Services", "XLC"],
  Utilities: ["Utilities", "XLU"],
};

const tickerOverrides: Record<string, [string, string, string]> = {
  AAPL: ["Technology", "XLK", "Consumer electronics"],
  AMZN: ["Consumer Discretionary", "XLY", "E-commerce and cloud"],
  COIN: ["Financials", "XLF", "Crypto infrastructure"],
  GOOGL: ["Communication Services", "XLC", "Digital advertising and AI"],
  META: ["Communication Services", "XLC", "Digital advertising and AI"],
  MSTR: ["Technology", "XLK", "Enterprise software and crypto"],
  NFLX: ["Communication Services", "XLC", "Streaming entertainment"],
  NVDA: ["Technology", "XLK", "Semiconductors"],
  PLTR: ["Technology", "XLK", "AI software"],
  TSLA: ["Consumer Discretionary", "XLY", "Electric vehicles"],
};

function slug(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

function inferFromCompany(company: string): [string, string, string] {
  const name = company.toLowerCase();
  if (/bank|bancorp|financial|capital|insurance|credit|asset management|mortgage|payments?/.test(name)) return ["Financials", "XLF", "Financial services"];
  if (/therapeutic|pharma|bio\b|bioscience|medical|health|care|surgical|diagnostic|genomic|clinic/.test(name)) return ["Healthcare", "XLV", "Biotechnology and healthcare"];
  if (/energy|petroleum|oil|gas|drilling|offshore|solar|uranium|resources/.test(name)) return ["Energy", "XLE", "Energy"];
  if (/software|systems|technology|digital|data|semiconductor|micro|network|cyber|cloud|comput|electronics/.test(name)) return ["Technology", "XLK", "Software and technology"];
  if (/utility|utilities|electric|power|water/.test(name)) return ["Utilities", "XLU", "Utilities"];
  if (/reit|realty|properties|property|storage trust|tower corporation/.test(name)) return ["Real Estate", "XLRE", "Real estate"];
  if (/steel|metals?|mining|chemical|materials|paper|forest/.test(name)) return ["Materials", "XLB", "Materials"];
  if (/telecom|communications|media|entertainment|news|broadcast|advertising/.test(name)) return ["Communication Services", "XLC", "Media and communications"];
  if (/foods?|beverage|grocery|tobacco|household|consumer products/.test(name)) return ["Consumer Staples", "XLP", "Consumer staples"];
  if (/airline|transport|logistics|industrial|aerospace|defense|machinery|engineering|construction/.test(name)) return ["Industrials", "XLI", "Industrials"];
  return ["Consumer Discretionary", "XLY", "Consumer products and services"];
}

function normalize(row: NasdaqScreenerRow): SectorMetadata {
  const symbol = row.symbol?.trim().toUpperCase() ?? "";
  const override = tickerOverrides[symbol];
  const rawSector = row.sector?.trim() ?? "";
  const normalized = sectorAliases[rawSector];
  const [sector, sectorTicker, fallbackTheme] = override ?? (normalized
    ? [normalized[0], normalized[1], `${normalized[0]} diversified`]
    : inferFromCompany(row.name ?? ""));
  const theme = override?.[2] ?? (row.industry?.trim() || fallbackTheme);
  return { sector, sectorTicker, theme, themeSlug: slug(theme) };
}

async function fetchNasdaqSectorMetadata() {
  const response = await fetch(NASDAQ_SCREENER_URL, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/market-activity/stocks/screener",
      "User-Agent": "Mozilla/5.0 SwingScanner/1.0",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Nasdaq screener returned ${response.status}`);
  const payload = await response.json() as { data?: { rows?: NasdaqScreenerRow[] } };
  const rows = payload.data?.rows;
  if (!rows?.length) throw new Error("Nasdaq screener returned no sector rows.");
  return Object.fromEntries(rows.flatMap((row) => row.symbol ? [[row.symbol.trim().toUpperCase(), normalize(row)]] : []));
}

export async function getSectorMetadataMap() {
  return (await withCache("metadata:nasdaq-sectors", 24 * 60 * 60 * 1000, fetchNasdaqSectorMetadata)).value;
}

export function getSectorTheme(symbol: string, company = symbol, metadata: Record<string, SectorMetadata> = {}) {
  return metadata[symbol] ?? normalize({ symbol, name: company });
}

export const LIQUID_SCAN_PRIORITY = [
  "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO",
  "AMD", "MU", "ARM", "ANET", "VRT", "PLTR", "CRWD", "PANW", "NET", "JPM",
  "GS", "BAC", "C", "COIN", "MSTR", "HOOD", "CEG", "VST", "CCJ", "ETN",
  "LMT", "AVAV", "KTOS", "RIVN", "NFLX", "UBER", "APP", "ORCL", "CRM", "NOW",
  "DDOG", "SNOW", "DELL", "SMCI", "MRVL", "QCOM", "AMAT", "LRCX", "KLAC", "INTC",
  "GE", "CAT", "BA", "RTX", "NOC", "XOM", "CVX", "COP", "SLB", "WMT",
  "COST", "HD", "LOW", "LLY", "VRTX", "REGN", "UNH", "ABBV", "GILD", "IONQ",
  "RGTI", "QBTS", "SOUN", "PATH", "ROKU",
];
