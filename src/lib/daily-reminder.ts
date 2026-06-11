import type { DailyReflection, DailyReminder, JournalTrade } from "@/types/domain";

const themes = [
  { id: "moving-stop", terms: ["move my stop", "moved my stop", "moving stop", "gave back"], message: "Do not move your stop after entry. Let the setup work or fail according to the original plan." },
  { id: "chasing", terms: ["chase", "chased", "extended"], message: "Be patient on entries. Do not chase an extended breakout; wait for a clean level, volume, and close." },
  { id: "candle-close", terms: ["5-minute close", "5 minute close", "before the close", "candle close"], message: "Wait for the 5-minute close before entering. Confirmation matters more than being first." },
  { id: "trim", terms: ["trim", "first tp", "take profit", "gave back gains"], message: "Protect the first target. Trim into strength instead of letting a winning trade turn into a scratch." },
  { id: "bad-fill", terms: ["bad fill", "good price", "didn't get filled", "did not get filled"], message: "Make the contract fill part of the setup. Skip entries where the spread prevents a clean execution." },
  { id: "overnight", terms: ["overnight", "orb"], message: "If the breakout level moved overnight, wait for the 5-minute ORB and volume confluence instead of buying the first close." },
  { id: "market-state", terms: ["market reversing", "market state", "bad conditions", "choppy"], message: "Let the market state control aggression. In a reversal or choppy tape, wait for confirmation and reduce breakout attempts." },
  { id: "pivot", terms: ["30-minute pivot", "30 minute pivot", "wait for a pivot"], message: "If the market is reversing, wait for a 30-minute pivot before adding more bullish exposure." },
];

export function generateDailyReminder(reflections: DailyReflection[], trades: JournalTrade[], recentHistory = false): DailyReminder {
  const latestDate = reflections.map((item) => item.tradingDate).sort().at(-1) ?? null;
  const selected = recentHistory ? reflections.slice(-5) : reflections.filter((item) => item.tradingDate === latestDate);
  const tradeNotes = trades
    .filter((trade) => recentHistory || !latestDate || trade.closedAt === latestDate || trade.openedAt === latestDate)
    .flatMap((trade) => [trade.mistakes, trade.lessons, trade.emotionAfter]);
  const text = [...selected.flatMap((item) => [item.notes, item.endOfDayReflection, item.nextDayLesson]), ...tradeNotes]
    .join(" ")
    .toLowerCase();
  const directLesson = selected.map((item) => item.nextDayLesson.trim()).filter(Boolean).at(-1);
  if (directLesson) {
    return { tradingDate: new Date().toISOString().slice(0, 10), message: directLesson, theme: "direct-lesson", sourceDate: latestDate };
  }
  const scored = themes.map((theme) => ({ theme, score: theme.terms.filter((term) => text.includes(term)).length })).sort((a, b) => b.score - a.score)[0];
  return {
    tradingDate: new Date().toISOString().slice(0, 10),
    message: scored?.score ? scored.theme.message : "Wait for confirmation. Clean level, clean volume, clean close.",
    theme: scored?.score ? scored.theme.id : "default",
    sourceDate: latestDate,
  };
}
