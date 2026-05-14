import { describe, expect, it } from "vitest";
import { compareSeqPriority, seqValue } from "./seq";

describe("Seq priority ordering", () => {
  it("treats decimal Seq values as normal numbers", () => {
    expect(seqValue("0.9")).toBe(0.9);
    expect(seqValue("1")).toBe(1);
    expect(seqValue("10")).toBe(10);
  });

  it("sorts closer-to-zero Seq values first", () => {
    const rows = [
      { id: 10, seq: "1" },
      { id: 90, seq: "0.9" },
      { id: 20, seq: "2" },
      { id: 30, seq: null }
    ];

    expect(rows.sort(compareSeqPriority).map((row) => row.id)).toEqual([90, 10, 20, 30]);
  });

  it("ties broken by sheet_row so same-Seq items match the sheet's row order", () => {
    // Three items share Seq = "1.5". The sheet's natural order is the row index,
    // not the planning id. Without the sheet_row tiebreaker, id-50 (added later
    // but inserted higher in the sheet) would be sorted after id-200.
    const rows = [
      { id: 200, sheet_row: 42, seq: "1.5" },
      { id: 50, sheet_row: 11, seq: "1.5" },
      { id: 75, sheet_row: 27, seq: "1.5" }
    ];

    expect(rows.sort(compareSeqPriority).map((row) => row.sheet_row)).toEqual([11, 27, 42]);
  });
});
