"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AccountContextValue {
  configured: true;
  userId: string | null;
  username: string | null;
  stateLoaded: boolean;
  cloud: { flaggedTickers: string[] };
  register: (username: string, pin: string) => Promise<string | null>;
  signIn: (username: string, pin: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  toggleFlag: (ticker: string) => Promise<void>;
}

type AccountStatus = {
  ok: boolean;
  user: { id: string; username: string } | null;
  flaggedTickers: string[];
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [flaggedTickers, setFlaggedTickers] = useState<string[]>([]);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch("/api/account/status", { cache: "no-store" });
      const payload = await response.json() as AccountStatus;
      setUserId(payload.user?.id ?? null);
      setUsername(payload.user?.username ?? null);
      setFlaggedTickers(payload.flaggedTickers ?? []);
    } finally {
      setStateLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const authenticate = async (
    action: "register" | "sign-in",
    name: string,
    pin: string,
  ) => {
    const response = await fetch(`/api/account/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name, pin }),
    });
    const payload = await response.json() as {
      ok: boolean;
      error?: string;
      user?: { id: string; username: string };
    };
    if (!response.ok || !payload.ok || !payload.user) {
      return payload.error ?? "Account request failed.";
    }
    setUserId(payload.user.id);
    setUsername(payload.user.username);
    setFlaggedTickers([]);
    await loadState();
    return null;
  };

  const register = (name: string, pin: string) => authenticate("register", name, pin);
  const signIn = (name: string, pin: string) => authenticate("sign-in", name, pin);
  const signOut = async () => {
    await fetch("/api/account/sign-out", { method: "POST" });
    setUserId(null);
    setUsername(null);
    setFlaggedTickers([]);
  };
  const toggleFlag = async (ticker: string) => {
    if (!userId) return;
    const flags = flaggedTickers.includes(ticker)
      ? flaggedTickers.filter((item) => item !== ticker)
      : [...flaggedTickers, ticker];
    setFlaggedTickers(flags);
    const response = await fetch("/api/account/flags", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flags }),
    });
    if (!response.ok) setFlaggedTickers(flaggedTickers);
  };

  return (
    <AccountContext.Provider value={{
      configured: true,
      userId,
      username,
      stateLoaded,
      cloud: { flaggedTickers },
      register,
      signIn,
      signOut,
      toggleFlag,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useSwingAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useSwingAccount must be used inside AccountProvider");
  return value;
}
