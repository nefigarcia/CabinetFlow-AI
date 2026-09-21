import { describe, expect, it } from "vitest";
import { isValidInteriorComponentId, newInteriorComponentId } from "../";

describe("newInteriorComponentId", () => {
  it("returns a non-empty string", () => {
    const id = newInteriorComponentId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values across successive calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(newInteriorComponentId());
    expect(set.size).toBe(100);
  });
});

describe("isValidInteriorComponentId", () => {
  it("accepts non-empty strings (does NOT enforce UUID format — protects legacy rows)", () => {
    expect(isValidInteriorComponentId("abc")).toBe(true);
    expect(isValidInteriorComponentId("legacy-slug")).toBe(true);
  });

  it("rejects empty / whitespace-only / non-string", () => {
    expect(isValidInteriorComponentId("")).toBe(false);
    expect(isValidInteriorComponentId("   ")).toBe(false);
    expect(isValidInteriorComponentId(null)).toBe(false);
    expect(isValidInteriorComponentId(undefined)).toBe(false);
    expect(isValidInteriorComponentId(123)).toBe(false);
  });
});
