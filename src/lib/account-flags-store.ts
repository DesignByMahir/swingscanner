import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getAccountDataDir } from "@/lib/local-account-store";

const flagsSchema = z.array(z.string().regex(/^[A-Z0-9.-]{1,8}$/)).max(500);

export async function readAccountFlags(accountId: string) {
  try {
    return flagsSchema.parse(JSON.parse(await fs.readFile(path.join(getAccountDataDir(accountId), "flags.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeAccountFlags(accountId: string, flags: string[]) {
  const validated = flagsSchema.parse([...new Set(flags.map((flag) => flag.toUpperCase()))]);
  const accountDir = getAccountDataDir(accountId);
  await fs.mkdir(accountDir, { recursive: true });
  const target = path.join(accountDir, "flags.json");
  await fs.writeFile(`${target}.tmp`, JSON.stringify(validated, null, 2), "utf8");
  await fs.rename(`${target}.tmp`, target);
  return validated;
}
