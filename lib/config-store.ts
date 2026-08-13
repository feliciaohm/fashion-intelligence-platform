// Small key/value store for server-only config that must survive across
// requests and deploys -- API credentials, connected sheet URLs -- backed
// by the app_config table in Supabase (sql/create_app_config_supabase.sql).
// Replaces the earlier local-file (.credentials/*.json) approach, which
// worked locally but fails on Vercel: the deployed function's filesystem is
// read-only outside /tmp, confirmed directly by a real ENOENT trying to
// mkdir '.credentials' in production.
import { createServiceClient } from "@/lib/supabase/service";

export async function getConfig<T>(key: string): Promise<T | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`config-store read failed for "${key}": ${error.message}`);
  return (data?.value as T) ?? null;
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("app_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`config-store write failed for "${key}": ${error.message}`);
}

export async function deleteConfig(key: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("app_config").delete().eq("key", key);
  if (error) throw new Error(`config-store delete failed for "${key}": ${error.message}`);
}
