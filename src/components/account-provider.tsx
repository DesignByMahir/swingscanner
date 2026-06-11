"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { DailyReflection, JournalTrade } from "@/types/domain";
import { getSupabaseClient, usernameEmail } from "@/lib/supabase-client";

interface CloudState {
  journal: JournalTrade[];
  reflections: DailyReflection[];
  flaggedTickers: string[];
}

interface AccountContextValue {
  configured: boolean;
  userId: string | null;
  username: string | null;
  stateLoaded: boolean;
  cloud: CloudState;
  register: (username: string, password: string) => Promise<string | null>;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  saveJournal: (journal: JournalTrade[]) => Promise<void>;
  saveReflections: (reflections: DailyReflection[]) => Promise<void>;
  toggleFlag: (ticker: string) => Promise<void>;
}

const emptyCloud: CloudState = { journal: [], reflections: [], flaggedTickers: [] };
const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [cloud, setCloud] = useState<CloudState>(emptyCloud);

  const loadState = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data } = await supabase.from("user_state").select("journal, reflections, flagged_tickers").eq("user_id", id).maybeSingle();
    if (data) {
      setCloud({
        journal: Array.isArray(data.journal) ? data.journal as JournalTrade[] : [],
        reflections: Array.isArray(data.reflections) ? data.reflections as DailyReflection[] : [],
        flaggedTickers: Array.isArray(data.flagged_tickers) ? data.flagged_tickers : [],
      });
    } else {
      await supabase.from("user_state").insert({ user_id: id });
      setCloud(emptyCloud);
    }
    setStateLoaded(true);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setUserId(user?.id ?? null);
      setUsername((user?.user_metadata?.username as string | undefined) ?? null);
      if (user) void loadState(user.id);
      else setStateLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserId(user?.id ?? null);
      setUsername((user?.user_metadata?.username as string | undefined) ?? null);
      setStateLoaded(false);
      if (user) void loadState(user.id);
      else {
        setCloud(emptyCloud);
        setStateLoaded(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadState, supabase]);

  const register = async (name: string, password: string) => {
    if (!supabase) return "Cloud accounts are not configured yet.";
    const clean = name.trim().toLowerCase();
    if (clean.length < 3) return "Username must be at least 3 characters.";
    const { error } = await supabase.auth.signUp({ email: usernameEmail(clean), password, options: { data: { username: clean } } });
    return error?.message ?? null;
  };
  const signIn = async (name: string, password: string) => {
    if (!supabase) return "Cloud accounts are not configured yet.";
    const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(name), password });
    return error?.message ?? null;
  };
  const signOut = async () => { await supabase?.auth.signOut(); };
  const patchCloud = async (patch: Record<string, unknown>, next: CloudState) => {
    if (!supabase || !userId) return;
    setCloud(next);
    await supabase.from("user_state").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
  };
  const saveJournal = async (journal: JournalTrade[]) => patchCloud({ journal }, { ...cloud, journal });
  const saveReflections = async (reflections: DailyReflection[]) => patchCloud({ reflections }, { ...cloud, reflections });
  const toggleFlag = async (ticker: string) => {
    const flaggedTickers = cloud.flaggedTickers.includes(ticker)
      ? cloud.flaggedTickers.filter((item) => item !== ticker)
      : [...cloud.flaggedTickers, ticker];
    await patchCloud({ flagged_tickers: flaggedTickers }, { ...cloud, flaggedTickers });
  };

  return <AccountContext.Provider value={{ configured: Boolean(supabase), userId, username, stateLoaded, cloud, register, signIn, signOut, saveJournal, saveReflections, toggleFlag }}>{children}</AccountContext.Provider>;
}

export function useSwingAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useSwingAccount must be used inside AccountProvider");
  return value;
}
