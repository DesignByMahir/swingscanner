import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { JournalTrade } from "@/types/domain";
import { getAccountDataDir } from "@/lib/local-account-store";

export const journalTradeSchema = z.object({
  id: z.string().min(1).max(100),
  symbol: z.string().min(1).max(12),
  direction: z.enum(["Long", "Short"]),
  status: z.enum(["Open", "Closed"]),
  setup: z.string().max(100),
  openedAt: z.string().max(30),
  closedAt: z.string().max(30),
  quantity: z.number().nonnegative(),
  entryPrice: z.number().nonnegative(),
  exitPrice: z.number().nonnegative(),
  stopPrice: z.number().nonnegative(),
  fees: z.number().nonnegative(),
  confidence: z.number().min(1).max(5),
  followedPlan: z.boolean(),
  emotionBefore: z.string().max(500),
  emotionAfter: z.string().max(500),
  thesis: z.string().max(3000),
  mistakes: z.string().max(3000),
  lessons: z.string().max(3000),
  tags: z.array(z.string().max(50)).max(12),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export const journalTradesSchema = z.array(journalTradeSchema).max(10_000);

const dataDir = process.env.SWINGSCANNER_DATA_DIR ?? path.resolve(".data");
function journalPath(accountId?: string | null) {
  return path.join(accountId ? getAccountDataDir(accountId) : dataDir, "journal.json");
}

export async function readJournal(accountId?: string | null): Promise<JournalTrade[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(journalPath(accountId), "utf8"));
    return journalTradesSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeJournal(trades: JournalTrade[], accountId?: string | null) {
  const validated = journalTradesSchema.parse(trades);
  const target = journalPath(accountId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporaryPath = `${target}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(validated, null, 2), "utf8");
  await fs.rename(temporaryPath, target);
}
