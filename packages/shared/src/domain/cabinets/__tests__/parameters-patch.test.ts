import { describe, expect, it } from "vitest";
import {
  applyCabinetParametersPatch,
  doesParameterChangeRequireCadRecompute,
  isDeletableCabinetParameterKey,
} from "../";

describe("applyCabinetParametersPatch — canonical merge", () => {
  it("A — clearing profile ref removes the key from the bag", () => {
    const existing = { shelfCount: 3, constructionProfileId: "abc" };
    const patch = { constructionProfileId: null };
    const next = applyCabinetParametersPatch(existing, patch);
    expect(next).toEqual({ shelfCount: 3 });
    expect("constructionProfileId" in next).toBe(false);
  });

  it("B — clearing profile ref preserves unrelated keys", () => {
    const existing = {
      shelfCount: 3,
      drawerCount: 2,
      constructionProfileId: "abc",
      materialProfileId: "mat1",
    };
    const patch = { constructionProfileId: null };
    const next = applyCabinetParametersPatch(existing, patch);
    expect(next).toEqual({ shelfCount: 3, drawerCount: 2, materialProfileId: "mat1" });
  });

  it("C — mixed clear + set manufacturing change → correct next state", () => {
    const existing = { shelfCount: 3, constructionProfileId: "abc" };
    const patch = { constructionProfileId: null, shelfCount: 4 };
    const next = applyCabinetParametersPatch(existing, patch);
    expect(next).toEqual({ shelfCount: 4 });
  });

  it("D — clearing only key when it's the sole entry → empty object", () => {
    const existing = { constructionProfileId: "abc" };
    const patch = { constructionProfileId: null };
    const next = applyCabinetParametersPatch(existing, patch);
    expect(next).toEqual({});
  });

  it("E — setting profile ref to a new value", () => {
    const existing = { constructionProfileId: "abc" };
    const patch = { constructionProfileId: "new-id" };
    const next = applyCabinetParametersPatch(existing, patch);
    expect(next).toEqual({ constructionProfileId: "new-id" });
  });

  it("F — empty patch leaves existing untouched", () => {
    const existing = { shelfCount: 3, constructionProfileId: "abc" };
    const next = applyCabinetParametersPatch(existing, {});
    expect(next).toEqual(existing);
  });

  it("wallPlacement follows the delete-on-null convention", () => {
    const existing = {
      shelfCount: 3,
      wallPlacement: { wallId: "w1", offsetMm: 100, baseElevationMm: 0, facing: "into-room" },
    };
    const next = applyCabinetParametersPatch(existing, { wallPlacement: null });
    expect(next).toEqual({ shelfCount: 3 });
    expect("wallPlacement" in next).toBe(false);
  });

  it("NEVER mutates the existing input object", () => {
    const existing = { shelfCount: 3, constructionProfileId: "abc" };
    const snapshot = JSON.stringify(existing);
    applyCabinetParametersPatch(existing, { constructionProfileId: null, shelfCount: 4 });
    expect(JSON.stringify(existing)).toBe(snapshot);
  });

  it("returns a fresh object even when patch is empty", () => {
    const existing = { shelfCount: 3 };
    const next = applyCabinetParametersPatch(existing, undefined);
    expect(next).not.toBe(existing);
    expect(next).toEqual(existing);
  });
});

describe("isDeletableCabinetParameterKey", () => {
  it("profile refs are deletable", () => {
    expect(isDeletableCabinetParameterKey("constructionProfileId")).toBe(true);
    expect(isDeletableCabinetParameterKey("materialProfileId")).toBe(true);
    expect(isDeletableCabinetParameterKey("hardwareProfileId")).toBe(true);
  });
  it("wallPlacement is deletable", () => {
    expect(isDeletableCabinetParameterKey("wallPlacement")).toBe(true);
  });
  it("manufacturing keys are NOT deletable via this helper", () => {
    expect(isDeletableCabinetParameterKey("shelfCount")).toBe(false);
    expect(isDeletableCabinetParameterKey("drawerCount")).toBe(false);
  });
});

// ─── CAD recompute policy: prev-final vs next-final semantics ──────────────

describe("doesParameterChangeRequireCadRecompute — prev-vs-next final params", () => {
  it("A — clearing constructionProfileId → NO recompute (metadata)", () => {
    const prev = { shelfCount: 3, constructionProfileId: "abc" };
    const next = applyCabinetParametersPatch(prev, { constructionProfileId: null });
    // Diff iterates keys of `next`; only `shelfCount` is examined; unchanged.
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("B — clearing profile ref while other keys unchanged → NO recompute", () => {
    const prev = {
      shelfCount: 3, drawerCount: 2,
      constructionProfileId: "abc", materialProfileId: "mat1",
    };
    const next = applyCabinetParametersPatch(prev, { constructionProfileId: null });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("C — clearing profile ref AND changing shelfCount → YES because manufacturing", () => {
    const prev = { shelfCount: 3, constructionProfileId: "abc" };
    const next = applyCabinetParametersPatch(prev, {
      constructionProfileId: null, shelfCount: 4,
    });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(true);
  });

  it("D — setting profile ref to a NEW value → NO recompute (metadata classification)", () => {
    const prev = { shelfCount: 3, constructionProfileId: "abc" };
    const next = applyCabinetParametersPatch(prev, { constructionProfileId: "new-id" });
    // constructionProfileId is classified as "metadata" → change flagged
    // by the diff but not counted as manufacturing.
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("wallPlacement move → NO recompute (placement)", () => {
    const prev = {
      shelfCount: 3,
      wallPlacement: { wallId: "w1", offsetMm: 100, baseElevationMm: 0, facing: "into-room" },
    };
    const next = {
      shelfCount: 3,
      wallPlacement: { wallId: "w1", offsetMm: 800, baseElevationMm: 0, facing: "into-room" },
    };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("no-op PATCH (identical params) → NO recompute", () => {
    const prev = { shelfCount: 3, constructionProfileId: "abc" };
    const next = { shelfCount: 3, constructionProfileId: "abc" };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });
});
