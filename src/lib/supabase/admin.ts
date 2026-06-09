import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * For this internal MVP all data access happens on the server (Server
 * Components, Server Actions, Route Handlers), so we use the service-role key
 * which bypasses RLS. The key is never sent to the browser.
 *
 * When Supabase Auth is wired up later, swap reads to an SSR client scoped to
 * the authenticated user — the RLS policies for `authenticated` are already in
 * place in the schema migration.
 */
let client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run `supabase status` and update .env.local.",
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
