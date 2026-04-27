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
});
