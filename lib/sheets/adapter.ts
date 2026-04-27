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

export type NewPlanningInput = {
  id: number;
  name: string;
  release: string | null;
  status: string;
  type: string | null;
  category: string | null;
  subsystem: string | null;
  parentEpic: string | null;
  priority: number;
  impact: number;
  difficulty: number;
  rankScore: number;
  rEmails: string[];
  aEmails: string[];
  dEmails: string[];
  dueDate: string | null;
  comments: string | null;
  dod: string | null;
};

/**
 * Append a single row to the bottom of Planning.
 *
 * We do NOT use `values.append` with a range like A:Y — Sheets's table-detection
 * gets confused by the trailing auto-formula in column Y ("Is Ready?") and ends
 * up appending to the very last row of the sheet, sometimes shifted to a column
 * that is NOT A. Instead we anchor explicitly: read column A to find the next
 * empty row after the data block, then `values.update` that exact range.
 *
 * `valueInputOption: USER_ENTERED` keeps the sheet's auto-formula columns alive.
 */
export async function appendPlanningRow(input: NewPlanningInput, displayNames: Map<string, string>): Promise<void> {
  const sheets = sheetsClient();
  const lookup = (e: string) => displayNames.get(e) ?? e;
  const namesOf = (emails: string[]) => emails.map(lookup).join("/");

  // Column order per CLAUDE.md §4.1 (24 columns, A through X):
  //  1 id | 2 name | 3 release | 4 seq | 5 status | 6 type | 7 category | 8 subsystem |
  //  9 parent | 10 links | 11 rank_score | 12 priority | 13 impact | 14 experiments |
  // 15 difficulty | 16 r | 17 a | 18 d | 19 due | 20 comments | 21 dod | 22 blocker |
  // 23 blocked_since | 24 is_ready
  const row = [
    input.id,
    input.name,
    input.release ?? "",
    "",
    input.status,
    input.type ?? "",
    input.category ?? "",
    input.subsystem ?? "",
    input.parentEpic ?? "",
    "",
    input.rankScore,
    input.priority,
    input.impact,
    "",
    input.difficulty,
    namesOf(input.rEmails),
    namesOf(input.aEmails),
    namesOf(input.dEmails),
    input.dueDate ?? "",
    input.comments ?? "",
    input.dod ?? "",
    "",
    "",
    ""
  ];

  // Find the next empty row by reading column A only. The header is in row 1.
  const idColRes = await sheets.spreadsheets.values.get({
    spreadsheetId: env.mooseSheetId(),
    range: "Planning!A:A",
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  const idCol = (idColRes.data.values as unknown[][]) ?? [];
  let lastIdRow = 1; // header row
  for (let i = 0; i < idCol.length; i++) {
    const v = idCol[i]?.[0];
    if (v !== undefined && v !== null && v !== "") {
      lastIdRow = i + 1; // values is 0-indexed; sheet rows are 1-indexed
    }
  }
  const targetRow = lastIdRow + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.mooseSheetId(),
    range: `Planning!A${targetRow}:X${targetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] }
  });
}

/**
 * Build a deep link to a specific Planning row in Google Sheets.
 */
export function sheetRowUrl(sheetRow: number): string {
  const id = env.mooseSheetId();
  const gid = env.planningGid();
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}&range=A${sheetRow}`;
}

/**
 * V2: write a single cell on Planning. Used by the proposal-approval pathway
 * — both the AI Brief writeback (column Y / 25) and inspector_fix writes.
 *
 * `valueInputOption: USER_ENTERED` keeps adjacent auto-formula columns intact.
 * Throws on a non-2xx response so the approval handler can surface and roll back.
 */
export async function updatePlanningCell(
  sheetRow: number,
  column: string, // e.g. "Y" or "W"
  value: string | number | null
): Promise<void> {
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.mooseSheetId(),
    range: `Planning!${column}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value ?? ""]] }
  });
}

/**
 * Map Planning column index (1-based) to its A1 letter. Only goes up to col 26
 * because Planning is well within that bound; do not extend without testing
 * a wider sheet.
 */
export function planningColLetter(colIndex: number): string {
  if (colIndex < 1 || colIndex > 26) throw new Error(`unsupported planning col ${colIndex}`);
  return String.fromCharCode(64 + colIndex);
}

/** The "AI Brief" column. Spencer adds this manually before V2 ships (§2.5). */
export const AI_BRIEF_COL = "Y";
export const AI_BRIEF_COL_INDEX = 25;
