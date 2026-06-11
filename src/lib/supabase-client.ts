"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabaseClient() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}

export function usernameEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")}@users.swingscanner.app`;
}
