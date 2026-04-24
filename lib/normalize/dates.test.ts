import { describe, it, expect } from "vitest";
import { parseSheetDate, parseSheetInt, parseSheetBool, asText } from "./dates";

describe("parseSheetDate", () => {
  it("parses serials (2024-01-01 ≈ 45292)", () => {
    expect(parseSheetDate(45292)).toBe("2024-01-01");
  });
  it("parses ISO strings", () => {
    expect(parseSheetDate("2026-04-29")).toBe("2026-04-29");
  });
  it("parses US format", () => {
    expect(parseSheetDate("4/29/2026")).toBe("2026-04-29");
    expect(parseSheetDate("12/3/24")).toBe("2024-12-03");
  });
  it("returns null for empty/garbage", () => {
    expect(parseSheetDate(null)).toBeNull();
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("not a date")).toBeNull();
  });
});

describe("parseSheetInt", () => {
  it("handles numbers and numeric strings", () => {
    expect(parseSheetInt(7)).toBe(7);
    expect(parseSheetInt("111")).toBe(111);
    expect(parseSheetInt("1.0")).toBe(1);
  });
  it("returns null for blanks and non-numerics", () => {
    expect(parseSheetInt("")).toBeNull();
    expect(parseSheetInt("?")).toBeNull();
  });
});

describe("parseSheetBool", () => {
  it("parses TRUE/FALSE strings and actual bools", () => {
    expect(parseSheetBool(true)).toBe(true);
    expect(parseSheetBool("TRUE")).toBe(true);
    expect(parseSheetBool("false")).toBe(false);
  });
});

describe("asText", () => {
  it("trims and returns null for empty", () => {
    expect(asText("  hi  ")).toBe("hi");
    expect(asText("")).toBeNull();
    expect(asText(null)).toBeNull();
  });
});
