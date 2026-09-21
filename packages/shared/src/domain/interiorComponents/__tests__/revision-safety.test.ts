import { describe, expect, it } from "vitest";
import {
  cabinetInteriorComponentsArraySchema,
  type CabinetInteriorComponent,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 revision safety.
//
// Cabinet.parameters is captured wholesale by the existing Revision
// snapshot code (confirmed in the design audit). Since
// interiorComponents lives inside parameters as a JSON array, it is
// auto-included in the snapshot with no additional code needed.
//
// This test proves the array round-trips through JSON.stringify +
// JSON.parse + Zod re-parse WITHOUT losing:
//   · component ids (identity preserved through reorder / rename)
//   · order
//   · enabled flags
//   · discriminant fields
//   · optional metadata / sourceRef / verificationStatus
//   · target discriminant + index
// ═══════════════════════════════════════════════════════════════════════

const original: CabinetInteriorComponent[] = [
  {
    id: "trash-1",
    enabled: true,
    type: "trash_pullout",
    bins: 2,
    nominalBinSizeQt: 35,
    configuration: "double",
    sourceRef: "Bibb Cabinetry Layouts 8_24_26 x2.pdf",
    verificationStatus: "verified",
  },
  {
    id: "hidden-2",
    enabled: false,   // deliberately disabled
    type: "hidden_drawer",
    location: "above_trash",
    label: "Hidden small drawer above trash",
    notes: "Custom shop convention",
    metadata: { deferredCapability: "hardware_mount" },
  },
  {
    id: "utensil-3",
    enabled: true,
    type: "utensil_divider",
    removable: true,
    target: { kind: "drawer", index: 1 },
  },
  {
    id: "custom-4",
    enabled: true,
    type: "custom",
    label: "Shop-specific liner",
    spec: { note: "opaque" },
  },
];

describe("Revision snapshot round-trip preserves every interior-component field", () => {
  it("JSON round-trip preserves the byte-identical array", () => {
    const snapshot = JSON.stringify(original);
    const parsed = JSON.parse(snapshot) as unknown;
    // Zod-parse to confirm the snapshot conforms to the same array schema
    // the server enforces at PATCH time.
    const revalidated = cabinetInteriorComponentsArraySchema.parse(parsed);
    expect(revalidated).toEqual(original);
  });

  it("preserves component IDs after JSON round-trip", () => {
    const snapshot = JSON.stringify(original);
    const restored = JSON.parse(snapshot) as CabinetInteriorComponent[];
    expect(restored.map((c) => c.id)).toEqual(["trash-1", "hidden-2", "utensil-3", "custom-4"]);
  });

  it("preserves enabled flag (disabled component stays disabled)", () => {
    const restored = JSON.parse(JSON.stringify(original)) as CabinetInteriorComponent[];
    const hidden = restored.find((c) => c.id === "hidden-2");
    expect(hidden?.enabled).toBe(false);
  });

  it("preserves the exact order (Phase 3.0 supports user-controlled reorder)", () => {
    const restored = JSON.parse(JSON.stringify(original)) as CabinetInteriorComponent[];
    expect(restored.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });

  it("preserves nested target discriminants (drawer + index)", () => {
    const restored = JSON.parse(JSON.stringify(original)) as CabinetInteriorComponent[];
    const utensil = restored.find((c) => c.id === "utensil-3");
    expect(utensil?.target).toEqual({ kind: "drawer", index: 1 });
  });

  it("preserves optional metadata / sourceRef / verificationStatus", () => {
    const restored = JSON.parse(JSON.stringify(original)) as CabinetInteriorComponent[];
    const trash = restored.find((c) => c.id === "trash-1");
    expect(trash?.sourceRef).toBe("Bibb Cabinetry Layouts 8_24_26 x2.pdf");
    expect(trash?.verificationStatus).toBe("verified");
    const hidden = restored.find((c) => c.id === "hidden-2");
    expect(hidden?.metadata).toEqual({ deferredCapability: "hardware_mount" });
  });

  it("mutation between save + restore does NOT bleed into the snapshot", () => {
    const snapshot = JSON.stringify(original);
    // Simulate mid-session mutation
    (original[0] as unknown as { bins: number }).bins = 999;
    // Restore
    const restored = JSON.parse(snapshot) as CabinetInteriorComponent[];
    const trash = restored.find((c) => c.id === "trash-1");
    if (trash?.type === "trash_pullout") {
      expect(trash.bins).toBe(2); // snapshot preserved pre-mutation value
    }
  });
});
