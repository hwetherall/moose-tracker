/**
 * Runtime env accessors. Each getter throws only when invoked, not at import,
 * so `next build` works without production secrets present.
 */

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  googleServiceAccountJson: () => req("GOOGLE_SERVICE_ACCOUNT_JSON"),
  mooseSheetId: () => req("MOOSE_SHEET_ID"),
  planningGid: () => req("PLANNING_GID"),
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: () => req("CRON_SECRET"),
  jiraBaseUrl: () => process.env.JIRA_BASE_URL ?? "https://innovera.atlassian.net/browse",
  openrouterKey: () => req("OPENROUTER_API_KEY"),
  openaiKey: () => req("OPENAI_API_KEY")
};
