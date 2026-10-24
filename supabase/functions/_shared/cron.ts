import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * True when the request comes from one of the pg_cron jobs. The jobs send a
 * token the database generated and keeps in a private table; only the
 * database (via a service-role-only RPC) can confirm it, so no copy of the
 * token lives in function secrets or the repo.
 */
export async function isCronCall(admin: SupabaseClient, req: Request): Promise<boolean> {
  const token = req.headers.get("x-cron-secret");
  if (!token) return false;
  const { data, error } = await admin.rpc("verify_cron_token", { _token: token });
  if (error) console.error("verify_cron_token failed", error.message);
  return data === true;
}
