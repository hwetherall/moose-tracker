import type { Experiment, NormalizationWarning, PlanningItem } from "@/lib/types";
import { normalizeExperimentStatus } from "./status";
import { asText } from "./dates";

/**
 * Turn a raw Experiments row into an Experiment. Returns null if truly empty.
 * Synthesizes a key when the sheet's "Key" cell is null or a generic phrase.
 */
export function normalizeExperimentRow(
  row: unknown[],
  sheetRow: number,
  warnings: NormalizationWarning[]
): Experiment | null {
  const rawKey = asText(row[0]);
  const problem = asText(row[1]);
  const experiment = asText(row[2]);
  const question = asText(row[3]);
  const scope = asText(row[4]);
  const details = asText(row[5]);
  const statusRaw = asText(row[6]);
  const notes = asText(row[7]);

  // Fully empty row
  if (!rawKey && !problem && !experiment && !question && !scope && !details && !notes) {
    return null;
  }

  const genericKeys = new Set(["create jira ticket", "not tracked by us", "backlog"]);
  const key =
    !rawKey || genericKeys.has(rawKey.toLowerCase())
      ? `exp_${sheetRow}`
      : rawKey;

  const status = normalizeExperimentStatus(statusRaw, warnings);

  return {
    key,
    sheetRow,
    problem,
    problemPlanningId: null,
    experiment,
    question,
    scope,
    details,
    status,
    statusRaw,
    notes
  };
}

/**
 * Resolve Experiments.problem → Planning.id by fuzzy name substring match.
 * Also back-fills PlanningItem.experimentsRefs[].key where the raw ref matches
 * an Experiment.key.
 */
export function crossReferenceExperiments(
  planning: PlanningItem[],
  experiments: Experiment[],
  warnings: NormalizationWarning[]
): { planning: PlanningItem[]; experiments: Experiment[] } {
  const byKey = new Map(experiments.map((e) => [e.key.toLowerCase(), e]));

  const withExpRefs = planning.map((p) => ({
    ...p,
    experimentsRefs: p.experimentsRefs.map((r) => {
      const e = byKey.get(r.raw.toLowerCase());
      if (e) return { ...r, key: e.key };
      warnings.push({
        kind: "unresolved_experiment_ref",
        message: `Planning item ${p.id} references experiment "${r.raw}" which did not resolve`,
        context: { itemId: p.id, ref: r.raw }
      });
      return r;
    })
  }));

  const resolvedExperiments = experiments.map((e) => {
    if (!e.problem) return e;
    const needle = e.problem.toLowerCase();
    const matches = planning.filter(
      (p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())
    );
    return matches.length === 1 ? { ...e, problemPlanningId: matches[0].id } : e;
  });

  return { planning: withExpRefs, experiments: resolvedExperiments };
}
