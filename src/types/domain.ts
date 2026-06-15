export type SetupType =
  | "Breakout"
  | "8-Week EMA Bounce"
  | "8-Week EMA Reclaim"
  | "Leader Pullback"
  | "Tight Base"
  | "Undercut and Reclaim"
  | "Extended / Wait";

export type SetupLabel =
  | "Theme Leader Reset"
  | "8-Week EMA Bounce"
  | "8-Week EMA Reclaim"
  | "Market Leader Breakout"
  | "Strong Theme Breakout"
  | "Leader Pullback Near 8W EMA"
  | "Extended Leader - Wait for Pullback"
  | "Setup Only - Not a Leader"
  | "Failed Breakout / Rejection Candle"
  | "Broken Leader - Lost 8W EMA"
  | "Low Quality Momentum";

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
  tactic: "Breakout" | "Bounce" | "Reclaim" | "Pullback" | "Avoid";
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
  setupLabel: SetupLabel;
  canonicalTheme: string;
  relative5Spy: number;
  relative5Qqq: number;
  relative20Spy: number;
  relative20Qqq: number;
  relative63Spy: number;
  relative63Qqq: number;
  weekEma8: number;
  weekEma21: number;
  distanceWeek8: number;
  weeklyTrendHealthy: boolean;
  themeScore: number;
  peerStrengthCount: number;
  scoreCap: number;
  capReasons: string[];
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
  change1d: number;
  change5d: number;
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
  candles: DailyCandle[];
  setup: StockSetup | null;
  summary: string;
}

export type DueDiligencePillarId = "financials" | "outlook" | "contracts" | "sector";

export interface DueDiligenceMetric {
  label: string;
  value: number | null;
  display: string;
  interpretation: string;
}

export interface DueDiligencePillar {
  id: DueDiligencePillarId;
  label: string;
  score: number | null;
  weight: number;
  summary: string;
  evidence: string[];
}

export interface DueDiligenceNewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  isContractSignal: boolean;
}

export interface DueDiligenceResult {
  ticker: string;
  company: string;
  instrumentType: string;
  researchedAt: string;
  provider: string;
  businessSummary: string;
  website: string | null;
  sector: string;
  industry: string;
  sectorTicker: string;
  overallScore: number;
  grade: "A+" | "A" | "B" | "Watch" | "Avoid";
  verdict: string;
  metrics: DueDiligenceMetric[];
  pillars: DueDiligencePillar[];
  bullCase: string[];
  risks: string[];
  news: DueDiligenceNewsItem[];
  warnings: string[];
}

export interface DueDiligenceLeaderboardEntry {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  overallScore: number;
  grade: "A+" | "A" | "B" | "Watch" | "Avoid";
  verdict: string;
  strongestPillar: string;
  strongestPillarScore: number | null;
}

export interface DueDiligenceLeaderboard {
  generatedAt: string;
  universeSize: number;
  entries: DueDiligenceLeaderboardEntry[];
  warnings: string[];
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
