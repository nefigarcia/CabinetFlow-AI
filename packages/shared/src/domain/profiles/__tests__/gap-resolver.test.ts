import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_FIELDS,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  effectiveVerificationGaps,
  mergeProfileFields,
  type EffectiveProfileBundle,
  type FieldProvenanceMap,
  type ProfilesBySourceBundle,
} from "../";
import type {
  CabinetMaterialProfileFields,
  ConstructionProfileFields,
  HardwareProfileFields,
} from "../types";

// Minimal helpers to compose profiles for gap tests.
function baseConstructionRow(over: Partial<ConstructionProfileFields> = {}, prov: FieldProvenanceMap | null = null) {
  return {
    id: "cp", verificationStatus: "unverified" as const, sourceRef: null, fieldProvenance: prov,
    constructionMethod: null, frontOverlayMode: null,
    carcassThicknessMm: null, drawerBoxThicknessMm: null, drawerBoxJoinery: null,
    backThicknessMm: null, adjustableShelfThicknessMm: null, nailerThicknessMm: null,
    ...over,
  };
}
function baseMaterialRow(over: Partial<CabinetMaterialProfileFields> = {}, prov: FieldProvenanceMap | null = null) {
  return {
    id: "mp", verificationStatus: "unverified" as const, sourceRef: null, fieldProvenance: prov,
    carcassMaterialSpec: null, drawerBoxMaterialSpec: null, faceFrameMaterialSpec: null,
    doorMaterialSpec: null, shelfMaterialSpec: null,
    backMaterialSpec: null, adjustableShelfMaterialSpec: null, nailerMaterialSpec: null,
    ...over,
  };
}
function baseHardwareRow(over: Partial<HardwareProfileFields> = {}, prov: FieldProvenanceMap | null = null) {
  return {
    id: "hp", verificationStatus: "unverified" as const, sourceRef: null, fieldProvenance: prov,
    hingeManufacturer: null, hingeSoftClose: null, hingeSystem: null,
    drawerSlideManufacturer: null, drawerSlideSoftClose: null, drawerSlideSystem: null,
    ...over,
  };
}
function emptyBundle(): { merged: EffectiveProfileBundle; profilesBySource: ProfilesBySourceBundle } {
  return {
    merged: {
      construction: mergeProfileFields(CONSTRUCTION_FIELDS, []),
      material:     mergeProfileFields(MATERIAL_FIELDS, []),
      hardware:     mergeProfileFields(HARDWARE_FIELDS, []),
    },
    profilesBySource: { construction: {}, material: {}, hardware: {} },
  };
}

describe("effectiveVerificationGaps — verified field closes mapped gap", () => {
  it("Bearnson provides backThicknessMm=6.35 (verified) → back_thickness resolves", () => {
    const cRow = baseConstructionRow(
      { backThicknessMm: 6.35 },
      { backThicknessMm: { status: "verified", sourceRef: "Bearnson" } },
    );
    const merged = {
      construction: mergeProfileFields(CONSTRUCTION_FIELDS, [
        { source: "organization", profile: cRow },
      ]),
      material:     mergeProfileFields(MATERIAL_FIELDS, []),
      hardware:     mergeProfileFields(HARDWARE_FIELDS, []),
    };
    const result = effectiveVerificationGaps({
      merged,
      contributingRaw: [{ verificationGaps: ["back_thickness"] }],
      profilesBySource: {
        construction: { organization: { fieldProvenance: cRow.fieldProvenance } },
        material:     {},
        hardware:     {},
      },
      purpose: "shop_profile_completeness",
    });
    expect(result.resolved).toContain("back_thickness");
    expect(result.open).not.toContain("back_thickness");
  });
});

describe("effectiveVerificationGaps — unverified value does NOT close gap", () => {
  it("hingeSystem set but provenance unverified → hinge_system_family stays open", () => {
    const hRow = baseHardwareRow(
      { hingeSystem: "GuessedSystem" },
      { hingeSystem: { status: "unverified", sourceRef: null } },
    );
    const merged = {
      construction: mergeProfileFields(CONSTRUCTION_FIELDS, []),
      material:     mergeProfileFields(MATERIAL_FIELDS, []),
      hardware:     mergeProfileFields(HARDWARE_FIELDS, [
        { source: "organization", profile: hRow },
      ]),
    };
    const shop = effectiveVerificationGaps({
      merged,
      contributingRaw: [{ verificationGaps: ["hinge_system_family"] }],
      profilesBySource: {
        construction: {},
        material:     {},
        hardware:     { organization: { fieldProvenance: hRow.fieldProvenance } },
      },
      purpose: "shop_profile_completeness",
    });
    expect(shop.open).toContain("hinge_system_family");
    expect(shop.resolved).not.toContain("hinge_system_family");
  });
});

describe("effectiveVerificationGaps — purpose distinction", () => {
  it("project_specific field CLOSES project_readiness but NOT shop_profile_completeness", () => {
    const cRow = baseConstructionRow(
      { constructionMethod: "face_frame" },
      { constructionMethod: { status: "project_specific", sourceRef: "Bibb" } },
    );
    const merged = {
      construction: mergeProfileFields(CONSTRUCTION_FIELDS, [
        { source: "project", profile: cRow },
      ]),
      material:     mergeProfileFields(MATERIAL_FIELDS, []),
      hardware:     mergeProfileFields(HARDWARE_FIELDS, []),
    };
    // Note: constructionMethod is not currently a mapped gap key. Use
    // door_material as a legitimate mapped example.
    const mRow = baseMaterialRow(
      { doorMaterialSpec: "Rustic White Oak, Shaker" },
      { doorMaterialSpec: { status: "project_specific", sourceRef: "Bibb" } },
    );
    const mergedWithMaterial = {
      ...merged,
      material: mergeProfileFields(MATERIAL_FIELDS, [
        { source: "project", profile: mRow },
      ]),
    };
    const bySource = {
      construction: {},
      material:     { project: { fieldProvenance: mRow.fieldProvenance } },
      hardware:     {},
    };
    const shop = effectiveVerificationGaps({
      merged: mergedWithMaterial,
      contributingRaw: [{ verificationGaps: ["door_material"] }],
      profilesBySource: bySource,
      purpose: "shop_profile_completeness",
    });
    const projectR = effectiveVerificationGaps({
      merged: mergedWithMaterial,
      contributingRaw: [{ verificationGaps: ["door_material"] }],
      profilesBySource: bySource,
      purpose: "project_readiness",
    });
    expect(shop.open).toContain("door_material");
    expect(projectR.resolved).toContain("door_material");
  });
});

describe("effectiveVerificationGaps — unmapped keys stay open", () => {
  it("unknown gap key (forward-compat) → stays open under both purposes", () => {
    const { merged, profilesBySource } = emptyBundle();
    for (const purpose of ["shop_profile_completeness", "project_readiness"] as const) {
      const result = effectiveVerificationGaps({
        merged,
        contributingRaw: [{ verificationGaps: ["some_future_key_xyz"] }],
        profilesBySource,
        purpose,
      });
      expect(result.open).toContain("some_future_key_xyz");
      expect(result.resolved).toHaveLength(0);
    }
  });

  it("Klint drawer_system_selection_rule → no mapped field → stays open", () => {
    const { merged, profilesBySource } = emptyBundle();
    const r = effectiveVerificationGaps({
      merged,
      contributingRaw: [{ verificationGaps: ["drawer_system_selection_rule"] }],
      profilesBySource,
      purpose: "shop_profile_completeness",
    });
    expect(r.open).toContain("drawer_system_selection_rule");
  });
});

describe("effectiveVerificationGaps — dedup across scopes", () => {
  it("duplicate gap keys across scopes are deduped in output", () => {
    const { merged, profilesBySource } = emptyBundle();
    const r = effectiveVerificationGaps({
      merged,
      contributingRaw: [
        { verificationGaps: ["boring_system"] },
        { verificationGaps: ["boring_system"] },
      ],
      profilesBySource,
      purpose: "shop_profile_completeness",
    });
    const count = r.open.filter((g) => g === "boring_system").length;
    expect(count).toBe(1);
  });
});
