import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { DailyReflection } from "@/types/domain";

export const dailyReflectionSchema = z.object({
  id: z.string().min(1).max(100),
  tradingDate: z.string().min(10).max(10),
  notes: z.string().max(5000),
  endOfDayReflection: z.string().max(5000),
  nextDayLesson: z.string().max(2000),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export const dailyReflectionsSchema = z.array(dailyReflectionSchema).max(2000);
const dataDir = process.env.SWINGSCANNER_DATA_DIR ?? path.resolve(".data");
const reflectionPath = path.join(dataDir, "daily-reflections.json");

export async function readDailyReflections(): Promise<DailyReflection[]> {
  try {
    return dailyReflectionsSchema.parse(JSON.parse(await fs.readFile(reflectionPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeDailyReflections(reflections: DailyReflection[]) {
  const validated = dailyReflectionsSchema.parse(reflections);
  await fs.mkdir(dataDir, { recursive: true });
  const temporaryPath = `${reflectionPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(validated, null, 2), "utf8");
  await fs.rename(temporaryPath, reflectionPath);
}
