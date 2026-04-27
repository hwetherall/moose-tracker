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
  a: { seq: string | number | null | undefined; id: number },
  b: { seq: string | number | null | undefined; id: number }
): number {
  const seqDelta = seqValue(a.seq) - seqValue(b.seq);
  if (seqDelta !== 0) return seqDelta;
  return a.id - b.id;
}
