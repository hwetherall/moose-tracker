import { describe, it, expect } from "vitest";
import { resolveOwners, type AliasMap } from "./owners";
import type { NormalizationWarning } from "@/lib/types";

const aliases: AliasMap = new Map([
  ["pedram", "pedram@innovera.ai"],
  ["spencer", "spencer@innovera.ai"],
  ["daniel", "daniel@innovera.ai"],
  ["dan'l", "daniel@innovera.ai"],
  ["maksym", "maksym@innovera.ai"],
  ["maks", "maksym@innovera.ai"],
  ["max", "maksym@innovera.ai"],
  ["anna h.", "annah@innovera.ai"],
  ["annah", "annah@innovera.ai"],
  ["hanna", "hanna@innovera.ai"]
]);

describe("resolveOwners", () => {
  it("splits on / and resolves both halves", () => {
    const w: NormalizationWarning[] = [];
    expect(resolveOwners("Pedram/Dan'l", aliases, w)).toEqual([
      "pedram@innovera.ai",
      "daniel@innovera.ai"
    ]);
    expect(w).toHaveLength(0);
  });

  it("de-dupes duplicates across / and case variants", () => {
    const w: NormalizationWarning[] = [];
    expect(resolveOwners("Maks/Max", aliases, w)).toEqual(["maksym@innovera.ai"]);
  });

  it("warns on unknown alias and drops it from emails", () => {
    const w: NormalizationWarning[] = [];
    expect(resolveOwners("Pedram/Ghost", aliases, w)).toEqual(["pedram@innovera.ai"]);
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe("unknown_alias");
  });

  it("returns [] for null", () => {
    const w: NormalizationWarning[] = [];
    expect(resolveOwners(null, aliases, w)).toEqual([]);
    expect(w).toHaveLength(0);
  });

  it("also splits on comma", () => {
    const w: NormalizationWarning[] = [];
    expect(resolveOwners("Pedram, Spencer", aliases, w)).toEqual([
      "pedram@innovera.ai",
      "spencer@innovera.ai"
    ]);
  });
});
