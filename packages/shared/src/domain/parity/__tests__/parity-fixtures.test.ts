import { describe, expect, it } from "vitest";
import { PARITY_FIXTURES, findFixture } from "../fixtures";

describe("parity fixture registry", () => {
  it("covers all fixture types required by V2.1A", () => {
    const ids = PARITY_FIXTURES.map((f) => f.id);
    expect(ids).toContain("frameless-base");
    expect(ids).toContain("frameless-3drawer-base");
    expect(ids).toContain("wall-cabinet");
    expect(ids).toContain("tall-cabinet");
    expect(ids).toContain("sink-base");
    expect(ids).toContain("adjustable-shelves");
    expect(ids).toContain("face-frame-base");
    expect(ids).toContain("manual-part-cabinet");
  });

  it("every fixture has a unique id", () => {
    const ids = PARITY_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every fixture references at least one inventory key", () => {
    for (const fx of PARITY_FIXTURES) {
      expect(fx.exercises.length).toBeGreaterThan(0);
    }
  });

  it("findFixture returns the correct fixture by id", () => {
    const fx = findFixture("tall-cabinet");
    expect(fx).toBeDefined();
    expect(fx!.cabinet.type).toBe("tall");
  });

  it("findFixture returns undefined for unknown id", () => {
    expect(findFixture("does-not-exist")).toBeUndefined();
  });

  it("every fixture is flagged expectedDivergent (until V2.1B reconciles)", () => {
    for (const fx of PARITY_FIXTURES) {
      expect(fx.expectedDivergent).toBe(true);
    }
  });
});
