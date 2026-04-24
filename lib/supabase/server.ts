import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Server-only, read-through anon client. Use for server components on the web surface.
 * Auth is handled at the app layer (NextAuth); RLS allows authenticated reads.
 */
export function supabaseServer() {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
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
