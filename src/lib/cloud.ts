"use client";
/**
 * Optional Supabase cloud saves. Entirely inert unless both public env vars are
 * set. Only the public anon key is used in the browser; row-level security in
 * supabase/migrations restricts every row to its owner.
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { parseUniverse, serializeUniverse } from "@/engine/schema";
import type { Universe } from "@/engine/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;

export const cloudConfigured = Boolean(url && anon);

function sb() {
  if (!cloudConfigured) throw new Error("Cloud saves are not configured.");
  client ??= createClient(url!, anon!, { auth: { persistSession: true } });
  return client;
}

export interface CloudSave {
  slot: string;
  name: string;
  week: number;
  updated_at: string;
}

export async function currentUser(): Promise<User | null> {
  if (!cloudConfigured) return null;
  const { data } = await sb().auth.getUser();
  return data.user ?? null;
}

export async function signInWithEmail(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/settings` } });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await sb().auth.signOut();
}

export async function listCloudSaves(): Promise<CloudSave[]> {
  const { data, error } = await sb().from("universe_saves").select("slot,name,week,updated_at").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function uploadSave(slot: string, universe: Universe) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in first.");
  const { error } = await sb()
    .from("universe_saves")
    .upsert({ user_id: user.id, slot, name: `${universe.promotionName} — ${universe.name}`, week: universe.week, schema_version: universe.schemaVersion, data: JSON.parse(serializeUniverse(universe)), updated_at: new Date().toISOString() }, { onConflict: "user_id,slot" });
  if (error) throw new Error(error.message);
}

export async function downloadSave(slot: string): Promise<Universe> {
  const { data, error } = await sb().from("universe_saves").select("data").eq("slot", slot).single();
  if (error) throw new Error(error.message);
  return parseUniverse(JSON.stringify(data.data));
}

export async function deleteCloudSave(slot: string) {
  const { error } = await sb().from("universe_saves").delete().eq("slot", slot);
  if (error) throw new Error(error.message);
}
