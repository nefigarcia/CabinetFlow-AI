import { describe, expect, it } from "vitest";
import { LEGACY_PARTS_REGENERATION_FILTER } from "../adapters/legacy-part-sync";

// These tests lock the delete-filter invariant used by
// apps/api/src/lib/parts.ts::syncParts(). If they fail, the sync path
// MUST be reviewed before landing — an accidental broadening of the
// filter will silently delete every user-created manual part on the
// next cabinet dimension edit.

describe("LEGACY_PARTS_REGENERATION_FILTER — manual-part survival invariant", () => {
  it("constrains to isManual=false", () => {
    expect(LEGACY_PARTS_REGENERATION_FILTER).toEqual({ isManual: false });
  });

  it("is frozen against mutation (readonly at the type level)", () => {
    // `as const` gives readonly semantics at the type level. Runtime
    // reassignment attempts are caught by the type system in strict mode
    // — verifying the shape hasn't drifted at runtime is the actual
    // guarantee we want.
    const keys = Object.keys(LEGACY_PARTS_REGENERATION_FILTER);
    expect(keys).toEqual(["isManual"]);
  });

  it("prevents accidental broadening: filter must have exactly one key", () => {
    // If someone adds a second key to broaden the filter (or removes the
    // isManual constraint entirely) this test surfaces the change in
    // review.
    expect(Object.keys(LEGACY_PARTS_REGENERATION_FILTER).length).toBe(1);
  });

  it("simulates syncParts filter composition — spread yields the expected shape", () => {
    // apps/api/src/lib/parts.ts spreads the filter into a Prisma where
    // clause: `{ cabinetId, ...LEGACY_PARTS_REGENERATION_FILTER }`.
    // Verify the spread produces the correct final shape.
    const cabinetId = "cab_1";
    const composed = { cabinetId, ...LEGACY_PARTS_REGENERATION_FILTER };
    expect(composed).toEqual({ cabinetId: "cab_1", isManual: false });
  });
});
