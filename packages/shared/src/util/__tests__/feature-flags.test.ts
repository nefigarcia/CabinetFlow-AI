import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "../feature-flags";

describe("isFeatureEnabled", () => {
  it("treats 'true' as enabled", () => {
    expect(isFeatureEnabled("true")).toBe(true);
  });

  it("treats '1' as enabled", () => {
    expect(isFeatureEnabled("1")).toBe(true);
  });

  it("treats undefined as disabled (unset flag → OFF)", () => {
    expect(isFeatureEnabled(undefined)).toBe(false);
  });

  it("treats null as disabled", () => {
    expect(isFeatureEnabled(null)).toBe(false);
  });

  it("treats empty string as disabled", () => {
    expect(isFeatureEnabled("")).toBe(false);
  });

  it("treats 'false' as disabled (not permissive)", () => {
    expect(isFeatureEnabled("false")).toBe(false);
    expect(isFeatureEnabled("0")).toBe(false);
    expect(isFeatureEnabled("no")).toBe(false);
  });

  it("case-sensitive — 'TRUE' is NOT enabled (documented strictness)", () => {
    expect(isFeatureEnabled("TRUE")).toBe(false);
    expect(isFeatureEnabled("True")).toBe(false);
  });
});
