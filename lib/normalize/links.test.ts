import { describe, it, expect } from "vitest";
import { parseLinks } from "./links";

describe("parseLinks", () => {
  it("detects Jira PRMT / INV, graph, and other", () => {
    const out = parseLinks("PRMT-7, INV-1836, G7.5, 1763.0, something else");
    expect(out).toEqual([
      { id: "PRMT-7", type: "jira_prmt", raw: "PRMT-7" },
      { id: "INV-1836", type: "jira_inv", raw: "INV-1836" },
      { id: "G7.5", type: "graph", raw: "G7.5" },
      { id: "1763.0", type: "other", raw: "1763.0" },
      { id: "something else", type: "other", raw: "something else" }
    ]);
  });
  it("empty or null returns []", () => {
    expect(parseLinks(null)).toEqual([]);
    expect(parseLinks("")).toEqual([]);
    expect(parseLinks("   ")).toEqual([]);
  });
  it("uppercases jira keys regardless of input case", () => {
    const out = parseLinks("prmt-12");
    expect(out[0]).toMatchObject({ id: "PRMT-12", type: "jira_prmt" });
  });
});
