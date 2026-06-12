export const SECTOR_ETFS = ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"] as const;

export const SECTOR_NAMES: Record<(typeof SECTOR_ETFS)[number], string> = {
  XLB: "Materials",
  XLC: "Communication Services",
  XLE: "Energy",
  XLF: "Financials",
  XLI: "Industrials",
  XLK: "Technology",
  XLP: "Consumer Staples",
  XLRE: "Real Estate",
  XLU: "Utilities",
  XLV: "Healthcare",
  XLY: "Consumer Discretionary",
};

export const ALL_SECTORS = SECTOR_ETFS.map((ticker) => ({
  ticker,
  sector: SECTOR_NAMES[ticker],
}));
