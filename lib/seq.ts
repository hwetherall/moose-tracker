const NO_SEQUENCE = Number.POSITIVE_INFINITY;

export function seqValue(seq: string | number | null | undefined): number {
  if (seq === null || seq === undefined || seq === "") return NO_SEQUENCE;
  if (typeof seq === "number") return Number.isFinite(seq) ? seq : NO_SEQUENCE;

  const normalized = seq.trim().replace(",", ".");
  if (!normalized) return NO_SEQUENCE;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : NO_SEQUENCE;
}

export function compareSeqPriority(
  a: { seq: string | number | null | undefined; sheet_row?: number; id: number },
  b: { seq: string | number | null | undefined; sheet_row?: number; id: number }
): number {
  const seqDelta = seqValue(a.seq) - seqValue(b.seq);
  if (seqDelta !== 0) return seqDelta;
  // Tiebreak by sheet_row so items sharing a Seq match the sheet's natural order.
  // Fall back to id when sheet_row isn't available (e.g., legacy callers / tests).
  if (a.sheet_row !== undefined && b.sheet_row !== undefined) {
    return a.sheet_row - b.sheet_row;
  }
  return a.id - b.id;
}
