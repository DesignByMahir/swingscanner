export type SetupType =
  | "Base Builder"
  | "Breakout Setup"
  | "Bull Flag"
  | "Wedge Pop"
  | "Tight Consolidation"
  | "BB Squeeze"
  | "8 EMA Base"
  | "21 EMA Base";

export type ExtensionLabel =
  | "Clean"
  | "Slightly Extended"
  | "Very Extended"
  | "Avoid / Chasing";

export interface ScorePart {
  label: string;
  value: number;
  weight: number;
}

export interface TradePlan {
  bias: string;
  tactic: "Breakout" | "Avoid";
  breakoutLevel: number;
  alternateTrigger: number;
  baseLow: number;
  baseDays: number;
  tighteningPercent: number;
  trendlineStartDate: string;
  trendlineStartPrice: number;
  trendlineEndDate: string;
  trendlineEndPrice: number;
  entryLow: number;
  entryHigh: number;
  trigger: string;
  confirmation: string;
  stopRule: string;
  target1: number;
  target2: number;
  timeframe: string;
  avoid: string;
  invalidation: string;
}

export interface StockSetup {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  sectorTicker: string;
  sectorRank?: number;
  theme: string;
  themeSlug: string;
  price: number;
  change: number;
  adr: number;
  avgVolume: number;
  relativeVolume: number;
  marketCap: number | null;
  marketCapUnavailable?: boolean;
  analystRating: string | null;
  analystScore: number | null;
  optionsAvailable: boolean;
  optionExpiration: string | null;
  optionDte: number | null;
  optionIv: number | null;
  optionSpreadDollars: number | null;
  optionSpreadPct: number | null;
  optionOpenInterest: number | null;
  optionVolume: number | null;
  optionsTradabilityScore: number | null;
  rsi: number;
  distance8: number;
  distance21: number;
  distance50: number;
  rs: number;
  setup: SetupType;
  matchedSetups: SetupType[];
  setupQuality: number;
  extensionRisk: number;
  extension: ExtensionLabel;
  finalScore: number;
  grade: "A+" | "A" | "B" | "Watch" | "Avoid";
  status: "Actionable" | "Watch only" | "Blocked by market" | "Rejected";
  earningsDays: number;
  tighteningPercent: number;
  scoreParts: ScorePart[];
  reasons: string[];
  warnings: string[];
  plan: TradePlan;
}

export interface ScannerRules {
  maxWatchlistItems: number;
  maxScannerResults: number;
  maxUniverseSize: number;
  enableYahooFallback: boolean;
  dailyCacheHours: number;
  minOptionIv: number;
  maxOptionSpreadDollars: number;
  maxOptionSpreadPct: number;
  minOptionOpenInterest: number;
  minOptionsTradabilityScore: number;
  maxOptionsCandidates: number;
}

export type DataMode = "free-eod";

export interface UniverseSymbol {
  symbol: string;
  name: string;
  exchange: string;
  isETF: boolean;
  isTestIssue: boolean;
  source: "nasdaqtrader";
}

export interface DailyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ProviderStats {
  universeProvider: string;
  dailyPrimary: string;
  dailyFallback: string | null;
  cacheHits: number;
  cacheMisses: number;
  stooqRequests: number;
  yahooRequests: number;
  failedSymbols: number;
  warnings: string[];
}

export interface FreeScanResult {
  mode: DataMode;
  scanId: string;
  scanTimestamp: string;
  marketDate: string;
  durationMs: number;
  universeCount: number;
  scannedCount: number;
  passedBaseFilters: number;
  optionsEligibleCount?: number;
  optionsRejectedCount?: number;
  optionsGate?: {
    minIv: number;
    maxSpreadDollars: number;
    maxSpreadPct: number;
    minOpenInterest: number;
    minTradabilityScore: number;
  };
  failedCount: number;
  failures: Array<{ symbol: string; reason: string }>;
  providerStats: ProviderStats;
  sectorLeadership?: SectorLeadership[];
  topSetups: StockSetup[];
  watchlist: StockSetup[];
}

export interface SectorLeadership {
  rank: number;
  ticker: string;
  sector: string;
  score: number;
  change20d: number;
  change63d: number;
  relative20d: number;
  relative63d: number;
  above21Day: boolean;
  above50Day: boolean;
  isLeading: boolean;
}

export interface TickerResearchResult {
  ticker: string;
  company: string;
  researchedAt: string;
  marketDate: string;
  dataMode: "completed-daily";
  provider: string;
  price: number;
  change: number;
  sector: string;
  sectorTicker: string;
  theme: string;
  sectorStrength: number;
  optionsAvailable: boolean;
  optionExpiration: string | null;
  optionDte: number | null;
  optionIv: number | null;
  optionSpreadDollars: number | null;
  optionSpreadPct: number | null;
  optionOpenInterest: number | null;
  optionVolume: number | null;
  optionsTradabilityScore: number | null;
  setup: StockSetup | null;
  summary: string;
}

export interface SectorPerformance {
  rank: number;
  ticker: string;
  sector: string;
  price: number;
  change1d: number;
  change5d: number;
  change20d: number;
  change63d: number;
  relative20d: number;
  above20Day: boolean;
  above50Day: boolean;
  signal: "Leading" | "Improving" | "Mixed" | "Lagging";
  sparkline: number[];
  scannerCount: number;
  watchlistCount: number;
  actionableCount: number;
  averageSetupScore: number | null;
  topSetups: Array<{
    ticker: string;
    setup: SetupType;
    score: number;
  }>;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  relatedTickers: string[];
  scope: "watchlist" | "sector";
  context: string;
}

export interface MarketState {
  bias: "Bullish" | "Bearish" | "Mixed" | "Choppy";
  summary: string;
  spyTrend: string;
  qqqTrend: string;
  riskContext: string;
  leadingSectors: string[];
}

export interface MarketEvent {
  id: string;
  title: string;
  startsAt: string;
  impact: "High" | "Medium";
  source: string;
}

export interface MarketIntelligence {
  generatedAt: string;
  marketDate: string | null;
  source: string;
  watchlistTickers: string[];
  sectors: SectorPerformance[];
  news: MarketNewsItem[];
  marketState: MarketState;
  upcomingEvents: MarketEvent[];
  warnings: string[];
}

export type TradeDirection = "Long" | "Short";
export type TradeStatus = "Open" | "Closed";

export interface JournalTrade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  setup: string;
  openedAt: string;
  closedAt: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  fees: number;
  confidence: number;
  followedPlan: boolean;
  emotionBefore: string;
  emotionAfter: string;
  thesis: string;
  mistakes: string;
  lessons: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossPnl: number;
  netPnl: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number | null;
  expectancy: number;
  averageR: number | null;
  planAdherence: number;
  currentStreak: number;
  bestWinStreak: number;
}

export interface DailyReflection {
  id: string;
  tradingDate: string;
  notes: string;
  endOfDayReflection: string;
  nextDayLesson: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReminder {
  tradingDate: string;
  message: string;
  theme: string;
  sourceDate: string | null;
}
