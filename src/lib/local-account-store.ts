import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const dataDir = process.env.SWINGSCANNER_DATA_DIR ?? path.resolve(".data");
const accountsPath = path.join(dataDir, "accounts.json");
const secretPath = path.join(dataDir, "account-session-secret");
export const accountCookieName = "swingscanner_session";

const accountSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(32),
  usernameKey: z.string().min(3).max(32),
  pinSalt: z.string().min(16),
  pinHash: z.string().min(32),
  createdAt: z.string(),
});
const accountsSchema = z.array(accountSchema);
type AccountRecord = z.infer<typeof accountSchema>;

function normalizeUsername(username: string) {
  return username.trim().replace(/\s+/g, " ");
}

function validateCredentials(username: string, pin: string) {
  const clean = normalizeUsername(username);
  if (!/^[A-Za-z0-9 _.-]{3,32}$/.test(clean)) {
    throw new Error("Username must be 3-32 letters, numbers, spaces, dots, dashes, or underscores.");
  }
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be exactly six numbers.");
  return clean;
}

async function readAccounts(): Promise<AccountRecord[]> {
  try {
    return accountsSchema.parse(JSON.parse(await fs.readFile(accountsPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAccounts(accounts: AccountRecord[]) {
  await fs.mkdir(dataDir, { recursive: true });
  const temporaryPath = `${accountsPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(accountsSchema.parse(accounts), null, 2), "utf8");
  await fs.rename(temporaryPath, accountsPath);
}

async function migrateLegacyData(accountId: string) {
  const accountDir = getAccountDataDir(accountId);
  await fs.mkdir(accountDir, { recursive: true });
  await Promise.all([
    ["journal.json", "journal.json"],
    ["daily-reflections.json", "daily-reflections.json"],
  ].map(async ([legacyName, accountName]) => {
    try {
      await fs.access(path.join(accountDir, accountName));
    } catch {
      try {
        await fs.copyFile(path.join(dataDir, legacyName), path.join(accountDir, accountName));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }));
}

export async function createLocalAccount(username: string, pin: string) {
  const clean = validateCredentials(username, pin);
  const accounts = await readAccounts();
  const usernameKey = clean.toLowerCase();
  if (accounts.some((account) => account.usernameKey === usernameKey)) {
    throw new Error("That username already exists.");
  }
  const salt = randomBytes(16);
  const account: AccountRecord = {
    id: randomUUID(),
    username: clean,
    usernameKey,
    pinSalt: salt.toString("hex"),
    pinHash: scryptSync(pin, salt, 32).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  await writeAccounts([...accounts, account]);
  await migrateLegacyData(account.id);
  return { id: account.id, username: account.username };
}

export async function authenticateLocalAccount(username: string, pin: string) {
  const clean = validateCredentials(username, pin);
  const account = (await readAccounts()).find(
    (item) => item.usernameKey === clean.toLowerCase(),
  );
  if (!account) throw new Error("Username or PIN is incorrect.");
  const expected = Buffer.from(account.pinHash, "hex");
  const actual = scryptSync(pin, Buffer.from(account.pinSalt, "hex"), expected.length);
  if (!timingSafeEqual(expected, actual)) throw new Error("Username or PIN is incorrect.");
  return { id: account.id, username: account.username };
}

async function getSessionSecret() {
  try {
    return await fs.readFile(secretPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await fs.mkdir(dataDir, { recursive: true });
    const secret = randomBytes(32);
    await fs.writeFile(secretPath, secret);
    return secret;
  }
}

export async function createAccountSession(account: { id: string; username: string }) {
  const payload = Buffer.from(JSON.stringify({
    accountId: account.id,
    username: account.username,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", await getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function readAccountSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${accountCookieName}=`))?.slice(accountCookieName.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", await getSessionSecret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      accountId: string;
      username: string;
      expiresAt: number;
    };
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getAccountDataDir(accountId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error("Invalid account identifier.");
  return path.join(dataDir, "accounts", accountId);
}

export function accountSessionCookie(token: string) {
  return `${accountCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`;
}

export function clearAccountSessionCookie() {
  return `${accountCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
