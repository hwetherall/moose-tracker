import { describe, it, expect } from "vitest";
import { normalizePlanningStatus, normalizeExperimentStatus } from "./status";
import type { NormalizationWarning } from "@/lib/types";

describe("normalizePlanningStatus", () => {
  it("passes canonical values through untouched", () => {
    const w: NormalizationWarning[] = [];
    expect(normalizePlanningStatus("0-Done", w)).toBe("0-Done");
    expect(normalizePlanningStatus("2-ReadyForDev", w)).toBe("2-ReadyForDev");
    expect(w).toHaveLength(0);
  });
  it("maps observed non-canonical values", () => {
    const w: NormalizationWarning[] = [];
    expect(normalizePlanningStatus("In Progress", w)).toBe("1-InDev");
    expect(normalizePlanningStatus("Ready", w)).toBe("2-ReadyForDev");
    expect(w).toHaveLength(2);
  });
  it("trims whitespace before matching", () => {
    const w: NormalizationWarning[] = [];
    expect(normalizePlanningStatus("  1-InDev  ", w)).toBe("1-InDev");
    expect(w).toHaveLength(0);
  });
  it("empty status → 5-Backlog with warning", () => {
    const w: NormalizationWarning[] = [];
    expect(normalizePlanningStatus(null, w)).toBe("5-Backlog");
    expect(w).toHaveLength(1);
  });
});

describe("normalizeExperimentStatus", () => {
  const cases: [string, string][] = [
    ["Done V1", "0-Done"],
    ["Done", "0-Done"],
    ['"Done"', "0-Done"],
    ["Done-ish", "0-Done"],
    ["Blocked", "0-Blocked"],
    ["blocked", "0-Blocked"],
    ["QA", "1-InDev"],
    ["Ready for Dev", "2-ReadyForDev"],
    ["Backlog", "5-Backlog"]
  ];
  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} → ${expected}`, () => {
      const w: NormalizationWarning[] = [];
      expect(normalizeExperimentStatus(input, w)).toBe(expected);
    });
  }
  it("null → 5-Backlog with warning", () => {
    const w: NormalizationWarning[] = [];
    expect(normalizeExperimentStatus(null, w)).toBe("5-Backlog");
    expect(w).toHaveLength(1);
  });
});
