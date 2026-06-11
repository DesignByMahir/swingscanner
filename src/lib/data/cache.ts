import { promises as fs } from "node:fs";
import path from "node:path";

interface CacheEnvelope<T> {
  value: T;
  expiresAt: number;
  writtenAt: string;
}

const memory = new Map<string, CacheEnvelope<unknown>>();
const cacheDir = process.env.SWINGSCANNER_CACHE_DIR ?? path.resolve(".cache", "swingscanner");

function safeName(key: string) {
  return key.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
}

async function readFileCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(cacheDir, `${safeName(key)}.json`), "utf8")) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

async function writeFileCache<T>(key: string, envelope: CacheEnvelope<T>) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, `${safeName(key)}.json`), JSON.stringify(envelope), "utf8");
}

export async function getCached<T>(key: string, allowExpired = false): Promise<{ value: T; hit: boolean; stale: boolean } | null> {
  const envelope = (memory.get(key) as CacheEnvelope<T> | undefined) ?? await readFileCache<T>(key);
  if (!envelope) return null;
  const stale = envelope.expiresAt <= Date.now();
  if (stale && !allowExpired) return null;
  memory.set(key, envelope);
  return { value: envelope.value, hit: true, stale };
}

export async function setCached<T>(key: string, value: T, ttlMs: number) {
  const envelope: CacheEnvelope<T> = { value, expiresAt: Date.now() + ttlMs, writtenAt: new Date().toISOString() };
  memory.set(key, envelope);
  await writeFileCache(key, envelope);
}

export async function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const cached = await getCached<T>(key);
  if (cached) return { value: cached.value, hit: true };
  const value = await loader();
  await setCached(key, value, ttlMs);
  return { value, hit: false };
}
