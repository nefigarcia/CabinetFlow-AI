import { describe, expect, it } from "vitest";
import { cabinetInteriorComponentSchema } from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 correction §3 — strict per-type Zod contract.
//
// Every per-type schema uses `.strict()`. Unknown / cross-type fields
// are REJECTED, not silently stripped. This prevents:
//   · classic misuse: {type:"hidden_drawer", bins:2}  ← bins ∈ trash
//   · stale copies:   fields lingering after a client-side type switch
//     landing in the DB unvalidated
// ═══════════════════════════════════════════════════════════════════════

const BASE = { id: "abc", enabled: true };

describe("Strict per-type schemas — cross-type fields rejected", () => {
  it("hidden_drawer with trash_pullout.bins field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "hidden_drawer",
        bins: 2,
      }).success,
    ).toBe(false);
  });

  it("trash_pullout with hidden_drawer.location field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "trash_pullout",
        bins: 2,
        location: "above_trash",
      }).success,
    ).toBe(false);
  });

  it("rollout with drawer_divider.orientation field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "rollout",
        orientation: "vertical",
      }).success,
    ).toBe(false);
  });

  it("utensil_divider with drawer_divider.count field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "utensil_divider",
        count: 3,
      }).success,
    ).toBe(false);
  });

  it("spice_rack with trash_pullout.configuration field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "spice_rack",
        configuration: "double",
      }).success,
    ).toBe(false);
  });

  it("custom with rollout.openSides field → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "custom",
        label: "Shop-specific thing",
        openSides: true,
      }).success,
    ).toBe(false);
  });

  it("arbitrary unknown field on any component → REJECTED", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "rollout",
        _internalDebug: "should never survive",
      }).success,
    ).toBe(false);
  });

  it("valid same-type field DOES pass (regression fence)", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        ...BASE,
        type: "trash_pullout",
        bins: 2,
        nominalBinSizeQt: 35,
        configuration: "double",
      }).success,
    ).toBe(true);
  });

  it("optional base fields still accepted on every type", () => {
    for (const type of ["rollout", "trash_pullout", "custom"] as const) {
      const c: Record<string, unknown> = {
        ...BASE,
        type,
        label: "with label",
        notes: "notes",
        sourceRef: "some source",
        verificationStatus: "verified",
        metadata: { foo: "bar" },
      };
      // trash_pullout has a required field, custom has a required label
      if (type === "trash_pullout") c.bins = 2;
      if (type === "custom") c.label = "required label";
      expect(cabinetInteriorComponentSchema.safeParse(c).success).toBe(true);
    }
  });
});
