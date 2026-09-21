import { describe, expect, it } from "vitest";
import {
  cabinetInteriorComponentSchema,
  cabinetInteriorComponentsArraySchema,
  interiorComponentTargetSchema,
  INTERIOR_COMPONENT_TYPES,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 schema tests — every discriminant valid; invalid shapes
// rejected. Stable IDs required. Custom label required. Numeric fields
// reject 0 / negative / NaN.
// ═══════════════════════════════════════════════════════════════════════

const BASE = { id: "abc", enabled: true };

describe("cabinetInteriorComponentSchema — discriminated union", () => {
  it("all 11 built-in types are enumerated", () => {
    expect(INTERIOR_COMPONENT_TYPES).toEqual([
      "rollout",
      "trash_pullout",
      "tray_divider",
      "spice_rack",
      "knife_organizer",
      "utensil_divider",
      "drawer_divider",
      "hidden_drawer",
      "sink_pullout",
      "sponge_tilt_out",
      "custom",
    ]);
    // Explicit non-inclusion of pantry_pullout / adjustable_shelf per §.
    expect(INTERIOR_COMPONENT_TYPES).not.toContain("pantry_pullout");
    expect(INTERIOR_COMPONENT_TYPES).not.toContain("adjustable_shelf");
    expect(INTERIOR_COMPONENT_TYPES).not.toContain("fixed_shelf");
    expect(INTERIOR_COMPONENT_TYPES).not.toContain("appliance");
  });

  it("rollout accepts optional quantity + openSides", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout" }).success).toBe(true);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout", quantity: 3, openSides: true }).success,
    ).toBe(true);
  });

  it("rollout REJECTS non-positive / non-integer / NaN quantity", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout", quantity: 0 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout", quantity: -1 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout", quantity: 1.5 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "rollout", quantity: Number.NaN }).success).toBe(false);
  });

  it("trash_pullout REQUIRES bins (positive integer)", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "trash_pullout" }).success).toBe(false);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "trash_pullout", bins: 2 }).success,
    ).toBe(true);
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

  it("trash_pullout rejects bins=0, negative, non-integer", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "trash_pullout", bins: 0 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "trash_pullout", bins: -1 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "trash_pullout", bins: 1.5 }).success).toBe(false);
  });

  it("custom REQUIRES a non-empty label", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "custom" }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "custom", label: "" }).success).toBe(false);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "custom", label: "Shop-specific thing" }).success,
    ).toBe(true);
  });

  it("all types require a non-empty id", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ id: "", enabled: true, type: "rollout" }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ enabled: true, type: "rollout" }).success).toBe(false);
  });

  it("all types require enabled boolean", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ id: "x", type: "rollout" }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ id: "x", enabled: "yes", type: "rollout" }).success).toBe(false);
  });

  it("rejects unknown discriminant", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "pantry_pullout" }).success,
    ).toBe(false);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "adjustable_shelf" }).success,
    ).toBe(false);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...BASE, type: "not_a_thing" as never }).success,
    ).toBe(false);
  });

  it("preserves optional metadata + sourceRef + verificationStatus", () => {
    const parsed = cabinetInteriorComponentSchema.parse({
      ...BASE,
      type: "spice_rack",
      location: "interior",
      sourceRef: "Bibb Cabinetry Layouts 8_24_26 x2.pdf — page 12",
      verificationStatus: "verified",
      metadata: { note: "shop-specific" },
    });
    expect(parsed).toMatchObject({
      type: "spice_rack",
      location: "interior",
      sourceRef: "Bibb Cabinetry Layouts 8_24_26 x2.pdf — page 12",
      verificationStatus: "verified",
      metadata: { note: "shop-specific" },
    });
  });
});

describe("interiorComponentTargetSchema — 4-kind union", () => {
  it("accepts cabinet | drawer | door | shelf with valid indices", () => {
    expect(interiorComponentTargetSchema.safeParse({ kind: "cabinet" }).success).toBe(true);
    expect(interiorComponentTargetSchema.safeParse({ kind: "drawer", index: 0 }).success).toBe(true);
    expect(interiorComponentTargetSchema.safeParse({ kind: "door", index: 3 }).success).toBe(true);
    expect(interiorComponentTargetSchema.safeParse({ kind: "shelf", index: 2 }).success).toBe(true);
  });

  it("rejects negative index and non-integer index", () => {
    expect(interiorComponentTargetSchema.safeParse({ kind: "drawer", index: -1 }).success).toBe(false);
    expect(interiorComponentTargetSchema.safeParse({ kind: "drawer", index: 1.5 }).success).toBe(false);
  });

  it("does NOT accept opening.slotId (deferred until stable opening identity exists)", () => {
    expect(interiorComponentTargetSchema.safeParse({ kind: "opening", slotId: "abc" }).success).toBe(false);
  });
});

describe("cabinetInteriorComponentsArraySchema — array shape", () => {
  it("rejects null (must be array; empty array clears components)", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse(null).success).toBe(false);
  });

  it("accepts empty array (meaning: clear components)", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse([]).success).toBe(true);
  });

  it("rejects array containing invalid element", () => {
    const arr = [
      { ...BASE, type: "rollout" },
      { ...BASE, id: "y", type: "trash_pullout" }, // missing bins
    ];
    expect(cabinetInteriorComponentsArraySchema.safeParse(arr).success).toBe(false);
  });

  it("enforces defensive upper bound (200)", () => {
    const arr = Array.from({ length: 201 }, (_, i) => ({ ...BASE, id: `c${i}`, type: "rollout" as const }));
    expect(cabinetInteriorComponentsArraySchema.safeParse(arr).success).toBe(false);
  });
});
