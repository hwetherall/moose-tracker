import { supabaseServer } from "@/lib/supabase/server";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchReleases, fetchPeople } from "@/lib/queries/releases";
import { concentrationRisk } from "./concentration";
import { priorityInversion } from "./priorityInversion";
import { staleDiscovery } from "./staleDiscovery";
import { staleBlocked } from "./staleBlocked";
import { definitionGap } from "./definitionGap";
import { ownershipGap } from "./ownershipGap";
import { releaseRisk } from "./releaseRisk";
import type { Signal, SignalCheck, SignalContext, StatusEntry } from "./types";

const CHECKS: SignalCheck[] = [
  concentrationRisk,
  priorityInversion,
  staleDiscovery,
  staleBlocked,
  definitionGap,
  ownershipGap,
  releaseRisk
];

const SEVERITY_RANK: Record<Signal["severity"], number> = {
  warning: 0,
  observation: 1,
  info: 2
};

let cache: { value: Signal[]; expiresAt: number } | null = null;
const TTL_MS = 60_000;

async function loadStatusEntries(): Promise<StatusEntry[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("status_changes")
    .select("item_id, to_status, changed_at");
  if (error) {
    console.warn("status_changes query failed", error);
    return [];
  }
  return (data ?? []) as StatusEntry[];
}

export async function buildSignalContext(): Promise<SignalContext> {
  const [items, releases, people, statusEntries] = await Promise.all([
    fetchPlanningItems({}),
    fetchReleases(),
    fetchPeople(),
    loadStatusEntries()
  ]);
  return { items, releases, people, statusEntries, today: new Date() };
}

export function runSignals(ctx: SignalContext): Signal[] {
  const out: Signal[] = [];
  for (const check of CHECKS) {
    try {
      out.push(...check(ctx));
    } catch (e) {
      console.warn("signal check failed", e);
    }
  }
  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export async function getSignals(): Promise<Signal[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const ctx = await buildSignalContext();
  const signals = runSignals(ctx);
  cache = { value: signals, expiresAt: Date.now() + TTL_MS };
  return signals;
}

export type { Signal } from "./types";
