import { google } from "googleapis";
import { env } from "@/lib/env";
import type {
  Experiment,
  NormalizationWarning,
  PlanningItem,
  Release,
  SyncResult
} from "@/lib/types";
import type { AliasMap } from "@/lib/normalize/owners";
import { normalizePlanningRow } from "@/lib/normalize/planning";
import { normalizeExperimentRow, crossReferenceExperiments } from "@/lib/normalize/experiments";
import { resolveParentEpics } from "@/lib/normalize/parentEpic";
import { normalizeReleasesRows } from "@/lib/normalize/releases";

const RANGES = {
  planning: "Planning!A1:Y1041",
  experiments: "'Temp - Experiments Mapping'!A1:H1023",
  releases: "Releases!A1:G10"
};

function sheetsClient() {
  const creds = JSON.parse(env.googleServiceAccountJson());
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"] // scoped to sheets; prod config uses read-only in V1
  });
  return google.sheets({ version: "v4", auth });
}

async function readValues(sheets: ReturnType<typeof sheetsClient>, range: string): Promise<unknown[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.mooseSheetId(),
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER"
  });
  return (res.data.values as unknown[][]) ?? [];
}

export async function pullFromSheets(aliases: AliasMap): Promise<SyncResult> {
  const sheets = sheetsClient();
  const warnings: NormalizationWarning[] = [];

  const [planningRaw, experimentsRaw, releasesRaw] = await Promise.all([
    readValues(sheets, RANGES.planning),
    readValues(sheets, RANGES.experiments),
    readValues(sheets, RANGES.releases)
  ]);

  // Planning: row 1 is headers, skip it. sheetRow is 1-indexed, so body rows start at sheetRow=2.
  const planningBody = planningRaw.slice(1);
  const planningItems: PlanningItem[] = [];
  const seenIds = new Set<number>();
  for (let i = 0; i < planningBody.length; i++) {
    const row = planningBody[i];
    const sheetRow = i + 2;
    const item = normalizePlanningRow(row, sheetRow, aliases, warnings);
    if (!item) continue;
    if (seenIds.has(item.id)) {
      warnings.push({
        kind: "duplicate_id",
        message: `Duplicate Planning id ${item.id} at row ${sheetRow} — last-wins`,
        context: { id: item.id, sheetRow }
      });
    }
    seenIds.add(item.id);
    planningItems.push(item);
  }

  // Experiments: row 1 is headers
  const experimentsBody = experimentsRaw.slice(1);
  const experimentsByKey = new Map<string, Experiment>();
  for (let i = 0; i < experimentsBody.length; i++) {
    const item = normalizeExperimentRow(experimentsBody[i], i + 2, warnings);
    if (!item) continue;
    if (experimentsByKey.has(item.key)) {
      warnings.push({
        kind: "other",
        message: `Duplicate Experiment key ${item.key} at row ${item.sheetRow} — last-wins`,
        context: { key: item.key, sheetRow: item.sheetRow }
      });
    }
    experimentsByKey.set(item.key, item);
  }
  const experiments = Array.from(experimentsByKey.values());

  // Cross-reference + parent-epic resolution run after both sets are built.
  const xref = crossReferenceExperiments(planningItems, experiments, warnings);
  const planning = resolveParentEpics(xref.planning, warnings);

  const releases: Release[] = normalizeReleasesRows(releasesRaw);

  return { planning, experiments: xref.experiments, releases, warnings };
}

/**
 * V1.5 placeholder. Wire when chat/new-item ships.
 */
export async function writeToPlanningBottom(_row: unknown): Promise<{ id: number }> {
  throw new Error("writeToPlanningBottom not implemented until V1.5");
}

/**
 * Build a deep link to a specific Planning row in Google Sheets.
 */
export function sheetRowUrl(sheetRow: number): string {
  const id = env.mooseSheetId();
  const gid = env.planningGid();
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}&range=A${sheetRow}`;
}
