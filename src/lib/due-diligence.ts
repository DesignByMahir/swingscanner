import YahooFinance from "yahoo-finance2";
import { withCache } from "@/lib/data/cache";
import { ProviderRouter } from "@/lib/data/provider-router";
import { getSectorMetadataMap, getSectorTheme, SECTOR_NAMES } from "@/lib/data/sector-theme-map";
import {
  aggregateDueDiligenceScore,
  scoreContracts,
  scoreFinancials,
  scoreFundOutlook,
  scoreOutlook,
  scoreSector,
} from "@/lib/due-diligence-scoring";
import { changePercent } from "@/lib/scan/indicators";
import type {
  DueDiligenceMetric,
  DueDiligenceNewsItem,
  DueDiligencePillar,
  DueDiligenceResult,
} from "@/types/domain";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const contractPattern = /\b(contract|award|order|backlog|partnership|agreement|deal|supplier|selected|procurement)\b/i;
const sectorTickerByName = Object.fromEntries(
  Object.entries(SECTOR_NAMES).map(([ticker, sector]) => [sector, ticker]),
);

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percentDisplay(value: number | null) {
  return value === null ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
}

function compactMoney(value: number | null, currency = "USD") {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function metric(
  label: string,
  value: number | null,
  display: string,
  interpretation: string,
): DueDiligenceMetric {
  return { label, value, display, interpretation };
}

function describeGrowth(label: string, value: number | null) {
  if (value === null) return `${label} is unavailable from the free fundamentals source.`;
  if (value >= 0.2) return `${label} is expanding quickly at ${(value * 100).toFixed(1)}%.`;
  if (value >= 0.05) return `${label} is growing at a constructive ${(value * 100).toFixed(1)}%.`;
  if (value >= 0) return `${label} is positive but modest at ${(value * 100).toFixed(1)}%.`;
  return `${label} is contracting by ${Math.abs(value * 100).toFixed(1)}%.`;
}

function verdictFor(score: number) {
  if (score >= 85) return "Strong long-term evidence across the available pillars.";
  if (score >= 72) return "Constructive long-term candidate with specific risks to investigate.";
  if (score >= 60) return "Mixed evidence; the bull case needs stronger confirmation.";
  return "Weak or incomplete long-term evidence at the time of this report.";
}

async function loadDueDiligence(rawTicker: string): Promise<DueDiligenceResult> {
  const ticker = rawTicker.trim().toUpperCase().replaceAll(".", "-");
  if (!/^[A-Z^][A-Z0-9^.-]{0,11}$/.test(ticker)) {
    throw new Error("Enter a valid stock, ETF, or index ticker.");
  }

  const [search, summary, sectorMetadata] = await Promise.all([
    yahooFinance.search(ticker, { quotesCount: 8, newsCount: 12 }),
    yahooFinance.quoteSummary(ticker, {
      modules: [
        "assetProfile",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "earningsTrend",
        "fundProfile",
        "price",
        "topHoldings",
      ],
    }).catch(() => null),
    getSectorMetadataMap(),
  ]);
  const exact = search.quotes.find(
    (quote) => quote.isYahooFinance && quote.symbol.toUpperCase() === ticker,
  );
  if (!exact && !summary?.price?.symbol) {
    throw new Error(`No public market instrument was found for ${ticker}.`);
  }

  const profile = summary?.assetProfile;
  const financial = summary?.financialData;
  const statistics = summary?.defaultKeyStatistics;
  const price = summary?.price;
  const trend = summary?.earningsTrend?.trend ?? [];
  const currentYear = trend.find((item) => item.period === "0y") ?? trend.find((item) => item.period === "0q");
  const exactLongName = exact && "longname" in exact && typeof exact.longname === "string"
    ? exact.longname
    : undefined;
  const exactShortName = exact && "shortname" in exact && typeof exact.shortname === "string"
    ? exact.shortname
    : undefined;
  const exactQuoteType = exact && "quoteType" in exact && typeof exact.quoteType === "string"
    ? exact.quoteType
    : undefined;
  const company = price?.longName ?? price?.shortName ??
    exactLongName ??
    exactShortName ??
    ticker;
  const instrumentType = price?.quoteType ??
    exactQuoteType ??
    "UNKNOWN";
  const isEquity = instrumentType === "EQUITY";
  const isFundLike = instrumentType === "ETF" || instrumentType === "MUTUALFUND" || instrumentType === "INDEX";
  const mapped = getSectorTheme(ticker.replaceAll("-", "."), company, sectorMetadata);
  const fundCategory = summary?.defaultKeyStatistics?.category;
  const sector = isFundLike
    ? "Diversified market exposure"
    : profile?.sectorDisp ?? profile?.sector ?? mapped.sector;
  const industry = isFundLike
    ? fundCategory ?? summary?.fundProfile?.legalType ?? instrumentType
    : profile?.industryDisp ?? profile?.industry ?? mapped.theme;
  const sectorTicker = isFundLike
    ? ticker.replaceAll("-", ".")
    : sectorTickerByName[sector] ?? mapped.sectorTicker;

  const router = new ProviderRouter({ enableYahooFallback: true, dailyCacheHours: 6 });
  const [instrumentHistory, spyHistory, sectorHistory] = await Promise.all([
    router.getDaily(ticker.replaceAll("-", "."), 300),
    router.getDaily("SPY", 300),
    router.getDaily(sectorTicker, 300),
  ]);
  const instrumentCloses = instrumentHistory.candles?.map((bar) => bar.close) ?? [];
  const spyCloses = spyHistory.candles?.map((bar) => bar.close) ?? [];
  const sectorCloses = sectorHistory.candles?.map((bar) => bar.close) ?? [];
  const relative63Day = instrumentCloses.length >= 64 && spyCloses.length >= 64
    ? changePercent(instrumentCloses, 63) - changePercent(spyCloses, 63)
    : null;
  const latestPrice = instrumentCloses.at(-1) ?? numberOrNull(price?.regularMarketPrice);
  const average200 = instrumentCloses.length >= 200
    ? instrumentCloses.slice(-200).reduce((sum, value) => sum + value, 0) / 200
    : null;
  const above200Day = latestPrice !== null && average200 !== null ? latestPrice > average200 : null;

  const profitMargin = numberOrNull(financial?.profitMargins);
  const revenueGrowth = numberOrNull(financial?.revenueGrowth);
  const earningsGrowth = numberOrNull(financial?.earningsGrowth);
  const freeCashFlow = numberOrNull(financial?.freeCashflow);
  const totalRevenue = numberOrNull(financial?.totalRevenue);
  const currentRatio = numberOrNull(financial?.currentRatio);
  const debtToEquity = numberOrNull(financial?.debtToEquity);
  const forwardRevenueGrowth = numberOrNull(currentYear?.revenueEstimate.growth);
  const forwardEarningsGrowth = numberOrNull(currentYear?.earningsEstimate.growth ?? currentYear?.growth);
  const currentPrice = numberOrNull(financial?.currentPrice ?? price?.regularMarketPrice);
  const targetPrice = numberOrNull(financial?.targetMeanPrice);
  const analystUpside = currentPrice && targetPrice ? targetPrice / currentPrice - 1 : null;
  const upwardRevisions = (currentYear?.epsRevisions.upLast30days ?? 0) + (currentYear?.epsRevisions.upLast7days ?? 0);
  const downwardRevisions = (currentYear?.epsRevisions.downLast30days ?? 0) + (currentYear?.epsRevisions.downLast7Days ?? 0);
  const ytdReturn = numberOrNull(statistics?.ytdReturn);
  const threeYearAverageReturn = numberOrNull(statistics?.threeYearAverageReturn);
  const fiveYearAverageReturn = numberOrNull(statistics?.fiveYearAverageReturn);
  const expenseRatio = numberOrNull(summary?.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio);
  const fundYield = numberOrNull(summary?.summaryDetail?.yield ?? statistics?.yield);
  const fundAssets = numberOrNull(summary?.summaryDetail?.totalAssets ?? statistics?.totalAssets);

  const relevantNews: DueDiligenceNewsItem[] = search.news
    .filter((item) => {
      if (item.relatedTickers?.includes(ticker)) return true;
      const title = item.title.toLowerCase();
      const companyToken = company.split(/\s+/)[0]?.toLowerCase();
      return title.includes(ticker.toLowerCase()) ||
        Boolean(companyToken && companyToken.length >= 4 && title.includes(companyToken));
    })
    .slice(0, 10)
    .map((item) => ({
      id: item.uuid,
      title: item.title,
      publisher: item.publisher,
      url: item.link,
      publishedAt: item.providerPublishTime.toISOString(),
      isContractSignal: contractPattern.test(item.title),
    }));
  const contractNews = relevantNews.filter((item) => item.isContractSignal);

  const financialScore = isEquity
    ? scoreFinancials({
      profitMargin,
      revenueGrowth,
      earningsGrowth,
      freeCashFlow,
      totalRevenue,
      currentRatio,
      debtToEquity,
    })
    : null;
  const outlookScore = isFundLike
    ? scoreFundOutlook({ ytdReturn, threeYearAverageReturn, fiveYearAverageReturn, expenseRatio })
    : scoreOutlook({
      forwardRevenueGrowth,
      forwardEarningsGrowth,
      analystUpside,
      upwardRevisions,
      downwardRevisions,
    });
  const contractsScore = isEquity ? scoreContracts(contractNews.length, relevantNews.length) : null;
  const sectorRelative = sectorCloses.length >= 64 && spyCloses.length >= 64
    ? changePercent(sectorCloses, 63) - changePercent(spyCloses, 63)
    : relative63Day;
  const sectorScore = scoreSector(sectorRelative, above200Day);

  const pillars: DueDiligencePillar[] = [
    {
      id: "financials",
      label: "Financials",
      score: financialScore,
      weight: 45,
      summary: financialScore === null
        ? "Company financial statements are not applicable or unavailable for this instrument."
        : `${percentDisplay(profitMargin)} profit margin with ${percentDisplay(revenueGrowth)} reported revenue growth.`,
      evidence: [
        describeGrowth("Revenue growth", revenueGrowth),
        describeGrowth("Earnings growth", earningsGrowth),
        freeCashFlow === null ? "Free cash flow is unavailable." : `Free cash flow is ${compactMoney(freeCashFlow, financial?.financialCurrency ?? "USD")}.`,
      ],
    },
    {
      id: "outlook",
      label: "Outlook",
      score: outlookScore,
      weight: 35,
      summary: isFundLike
        ? `${percentDisplay(threeYearAverageReturn)} three-year and ${percentDisplay(fiveYearAverageReturn)} five-year average return.`
        : `${percentDisplay(forwardRevenueGrowth)} estimated revenue growth and ${percentDisplay(forwardEarningsGrowth)} estimated EPS growth.`,
      evidence: isFundLike
        ? [
          `Year-to-date return is ${percentDisplay(ytdReturn)}.`,
          expenseRatio === null ? "The fund expense ratio is unavailable." : `Annual expense ratio is ${percentDisplay(expenseRatio)}.`,
        ]
        : [
          analystUpside === null ? "A consensus price target is unavailable." : `Consensus target implies ${percentDisplay(analystUpside)} versus the current quote.`,
          `${upwardRevisions} upward and ${downwardRevisions} downward EPS revisions were reported for the selected estimate period.`,
        ],
    },
    {
      id: "contracts",
      label: "Contracts",
      score: contractsScore,
      weight: 5,
      summary: !isEquity
        ? "Company contract scoring is not applicable to this instrument."
        : contractNews.length
        ? `${contractNews.length} recent headline${contractNews.length === 1 ? "" : "s"} mention a contract, award, order, partnership, or agreement.`
        : "No recent contract-specific headline was identified in the returned news set.",
      evidence: !isEquity
        ? ["Use holdings, mandate, fees, liquidity, and benchmark exposure for fund due diligence."]
        : contractNews.length
        ? contractNews.slice(0, 3).map((item) => item.title)
        : ["Absence of a matching headline is not proof that the company has no contracts."],
    },
    {
      id: "sector",
      label: "Sector",
      score: sectorScore,
      weight: 15,
      summary: `${sector} / ${industry}; ${sectorTicker} is the comparison benchmark.`,
      evidence: [
        sectorRelative === null ? "Sector-relative 63-day performance is unavailable." : `${sectorTicker} is ${sectorRelative.toFixed(1)} percentage points versus SPY over 63 sessions.`,
        above200Day === null ? "The 200-day trend could not be calculated." : `${ticker} is ${above200Day ? "above" : "below"} its 200-day average.`,
      ],
    },
  ];
  const aggregate = aggregateDueDiligenceScore(pillars);
  const bullCase = [
    ...(revenueGrowth !== null && revenueGrowth > 0.08 ? [describeGrowth("Reported revenue", revenueGrowth)] : []),
    ...(earningsGrowth !== null && earningsGrowth > 0.08 ? [describeGrowth("Reported earnings", earningsGrowth)] : []),
    ...(freeCashFlow !== null && freeCashFlow > 0 ? [`Positive free cash flow of ${compactMoney(freeCashFlow, financial?.financialCurrency ?? "USD")} supports reinvestment and capital returns.`] : []),
    ...(forwardRevenueGrowth !== null && forwardRevenueGrowth > 0.05 ? [describeGrowth("Estimated revenue", forwardRevenueGrowth)] : []),
    ...(relative63Day !== null && relative63Day > 0 ? [`The instrument has outperformed SPY by ${relative63Day.toFixed(1)} percentage points over 63 sessions.`] : []),
    ...contractNews.slice(0, 2).map((item) => `Potential commercial catalyst: ${item.title}`),
  ].slice(0, 6);
  const risks = [
    ...(profitMargin !== null && profitMargin < 0 ? ["The business is currently unprofitable on the returned trailing data."] : []),
    ...(revenueGrowth !== null && revenueGrowth < 0 ? ["Reported revenue is contracting."] : []),
    ...(forwardRevenueGrowth !== null && forwardRevenueGrowth < 0 ? ["Consensus estimates imply declining forward revenue."] : []),
    ...(debtToEquity !== null && debtToEquity > 150 ? [`Debt-to-equity is elevated at ${debtToEquity.toFixed(1)}%.`] : []),
    ...(above200Day === false ? ["The price is below its 200-day average, weakening the current long-term trend."] : []),
    ...(analystUpside !== null && analystUpside < 0 ? ["The consensus target is below the current quote."] : []),
  ].slice(0, 6);

  const companyMetrics: DueDiligenceMetric[] = [
    metric("Revenue", totalRevenue, compactMoney(totalRevenue, financial?.financialCurrency ?? "USD"), describeGrowth("Reported revenue growth", revenueGrowth)),
    metric("Revenue growth", revenueGrowth, percentDisplay(revenueGrowth), describeGrowth("Revenue growth", revenueGrowth)),
    metric("Profit margin", profitMargin, percentDisplay(profitMargin), profitMargin === null ? "Profitability is unavailable." : profitMargin > 0 ? "The company is profitable on a trailing basis." : "The company is currently loss-making."),
    metric("Free cash flow", freeCashFlow, compactMoney(freeCashFlow, financial?.financialCurrency ?? "USD"), freeCashFlow === null ? "Cash generation is unavailable." : freeCashFlow > 0 ? "The business generated positive free cash flow." : "Free cash flow is negative."),
    metric("Forward revenue", forwardRevenueGrowth, percentDisplay(forwardRevenueGrowth), describeGrowth("Estimated revenue growth", forwardRevenueGrowth)),
    metric("Forward earnings", forwardEarningsGrowth, percentDisplay(forwardEarningsGrowth), describeGrowth("Estimated EPS growth", forwardEarningsGrowth)),
    metric("Forward P/E", numberOrNull(statistics?.forwardPE), statistics?.forwardPE ? `${statistics.forwardPE.toFixed(1)}x` : "Unavailable", "Valuation should be compared with growth, margins, and sector peers."),
    metric("Debt / equity", debtToEquity, debtToEquity === null ? "Unavailable" : `${debtToEquity.toFixed(1)}%`, debtToEquity === null ? "Leverage is unavailable." : debtToEquity > 150 ? "Leverage is elevated." : "Leverage is within the scoring model's normal range."),
  ];
  const fundMetrics: DueDiligenceMetric[] = [
    metric("Year-to-date return", ytdReturn, percentDisplay(ytdReturn), "Recent performance is context, not a forecast."),
    metric("3-year average", threeYearAverageReturn, percentDisplay(threeYearAverageReturn), "Annualized historical return from the fund profile."),
    metric("5-year average", fiveYearAverageReturn, percentDisplay(fiveYearAverageReturn), "Longer history helps reduce dependence on one market regime."),
    metric("Expense ratio", expenseRatio, percentDisplay(expenseRatio), "Lower recurring fees preserve more of the underlying return."),
    metric("Fund yield", fundYield, percentDisplay(fundYield), "Distribution yield may vary and should not be treated as guaranteed income."),
    metric("Total assets", fundAssets, compactMoney(fundAssets), "Asset scale can support liquidity but does not determine future returns."),
    metric("200-day trend", above200Day === null ? null : above200Day ? 1 : 0, above200Day === null ? "Unavailable" : above200Day ? "Above" : "Below", "A trend measure, not a fundamental valuation signal."),
    metric("63-day vs SPY", relative63Day, relative63Day === null ? "Unavailable" : `${relative63Day.toFixed(1)} pts`, "Relative performance against the broad US equity benchmark."),
  ];
  const metrics = isFundLike ? fundMetrics : companyMetrics;
  const warnings = [
    "Scores summarize available public data and are not a valuation model or investment recommendation.",
    "The stock model is shares-first: revenue growth, forward growth, profitability trajectory, balance sheet, and sector context carry the score.",
    ...(instrumentType !== "EQUITY" ? ["Company financial metrics are not scored for ETFs, funds, or indices."] : []),
    ...(contractNews.length ? ["Contract signals are based on linked headlines; open the source before relying on the claim."] : []),
  ];

  return {
    ticker,
    company,
    instrumentType,
    researchedAt: new Date().toISOString(),
    provider: "Yahoo Finance public data",
    businessSummary: profile?.longBusinessSummary ?? profile?.description ?? `${company} is a public market instrument. A detailed business description was unavailable.`,
    website: profile?.website ?? null,
    sector,
    industry,
    sectorTicker,
    overallScore: aggregate.score,
    grade: aggregate.grade,
    verdict: verdictFor(aggregate.score),
    metrics,
    pillars,
    bullCase: bullCase.length ? bullCase : ["No strong quantitative bull-case signal was available; use the linked evidence to continue the research."],
    risks: risks.length ? risks : ["No single quantitative red flag dominated the available data, but business, valuation, and macro risks still require review."],
    news: relevantNews,
    warnings,
  };
}

export async function researchDueDiligence(ticker: string) {
  const normalized = ticker.trim().toUpperCase();
  const cached = await withCache(
    `due-diligence:v3:${normalized}`,
    6 * 60 * 60 * 1000,
    () => loadDueDiligence(normalized),
  );
  return cached.value;
}
