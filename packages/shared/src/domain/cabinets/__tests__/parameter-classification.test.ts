import { describe, expect, it } from "vitest";
import {
  PLACEMENT_ONLY_PARAMETER_KEYS,
  diffParameterKeys,
  doesParameterChangeRequireCadRecompute,
} from "../parameter-classification";

// These tests guard the CAD-recompute policy for Cabinet PATCH. The
// route trusts this classifier — a regression here means every drag
// commit fires an unnecessary CAD service call OR a manufacturing
// change silently ships stale parts.

describe("diffParameterKeys", () => {
  it("returns empty when next is empty / undefined", () => {
    expect(diffParameterKeys({}, {})).toEqual([]);
    expect(diffParameterKeys(null, null)).toEqual([]);
    expect(diffParameterKeys({ shelfCount: 2 }, undefined)).toEqual([]);
  });

  it("flags only keys that materially changed", () => {
    const prev = { shelfCount: 2, drawerCount: 3, doorCount: 2 };
    const next = { shelfCount: 4, drawerCount: 3 };
    expect(diffParameterKeys(prev, next)).toEqual(["shelfCount"]);
  });

  it("treats structurally-equal nested objects as unchanged", () => {
    const prev = {
      wallPlacement: {
        wallId: "w1",
        offsetMm: 100,
        baseElevationMm: 0,
        facing: "into-room",
      },
    };
    const next = {
      wallPlacement: {
        wallId: "w1",
        offsetMm: 100,
        baseElevationMm: 0,
        facing: "into-room",
      },
    };
    expect(diffParameterKeys(prev, next)).toEqual([]);
  });

  it("flags a nested-object change on any field", () => {
    const prev = {
      wallPlacement: {
        wallId: "w1",
        offsetMm: 100,
        baseElevationMm: 0,
        facing: "into-room",
      },
    };
    const next = {
      wallPlacement: {
        wallId: "w1",
        offsetMm: 800,
        baseElevationMm: 0,
        facing: "into-room",
      },
    };
    expect(diffParameterKeys(prev, next)).toEqual(["wallPlacement"]);
  });

  it("ignores keys the patch did NOT include (partial merge semantics)", () => {
    const prev = { shelfCount: 2, wallPlacement: { wallId: "w1" } };
    // Patch only touches wallPlacement — shelfCount stays as-is on the server.
    const next = { wallPlacement: { wallId: "w2" } };
    expect(diffParameterKeys(prev, next)).toEqual(["wallPlacement"]);
  });
});

describe("doesParameterChangeRequireCadRecompute", () => {
  it("is false when nothing changed", () => {
    expect(
      doesParameterChangeRequireCadRecompute(
        { shelfCount: 2 },
        { shelfCount: 2 },
      ),
    ).toBe(false);
  });

  it("is false for placement-only wallPlacement change (the drag case)", () => {
    const prev = {
      shelfCount: 2,
      wallPlacement: { wallId: "w1", offsetMm: 100 },
    };
    const next = { wallPlacement: { wallId: "w1", offsetMm: 800 } };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("is true for manufacturing parameters (shelfCount, drawerCount, doorCount)", () => {
    expect(
      doesParameterChangeRequireCadRecompute({ shelfCount: 2 }, { shelfCount: 4 }),
    ).toBe(true);
    expect(
      doesParameterChangeRequireCadRecompute(
        { drawerCount: 3 },
        { drawerCount: 4 },
      ),
    ).toBe(true);
    expect(
      doesParameterChangeRequireCadRecompute(
        { doorCount: 1 },
        { doorCount: 2 },
      ),
    ).toBe(true);
  });

  it("is true for unknown keys (safe default)", () => {
    // If a new manufacturing parameter lands but this file wasn't
    // updated, we still recompute rather than ship stale parts.
    expect(
      doesParameterChangeRequireCadRecompute(
        { thickness: 18 },
        { thickness: 25 },
      ),
    ).toBe(true);
  });

  it("is true when BOTH placement-only AND manufacturing changed", () => {
    const prev = {
      shelfCount: 2,
      wallPlacement: { wallId: "w1", offsetMm: 100 },
    };
    const next = {
      shelfCount: 4,
      wallPlacement: { wallId: "w1", offsetMm: 800 },
    };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(true);
  });
});

describe("PLACEMENT_ONLY_PARAMETER_KEYS", () => {
  it("currently lists wallPlacement as the only placement-only key", () => {
    // If this fails, either a new placement-only key was added
    // intentionally (update this test) or the list drifted (fix it).
    expect(PLACEMENT_ONLY_PARAMETER_KEYS).toEqual(["wallPlacement"]);
  });
});
