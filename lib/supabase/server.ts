import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Server-only read client. The web surface is gated by NextAuth middleware,
 * while Supabase RLS only recognizes Supabase auth JWTs. Use the service role
 * for server components so reads are not hidden behind the anon role.
 */
export function supabaseServer() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/**
 * Service role client. Bypasses RLS. Used exclusively by the sync job.
 * Never import from a route reachable by the browser.
 */
export function supabaseService() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
