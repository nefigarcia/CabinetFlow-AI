import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_FIELDS,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  effectiveFieldVerification,
  mergeProfileFields,
  type FieldProvenanceMap,
  type ProfileSource,
} from "../";
import type {
  CabinetMaterialProfileFields,
  ConstructionProfileFields,
  HardwareProfileFields,
} from "../types";

// Helpers to reduce noise in test bodies.
function orgConstructionRow(fields: Partial<ConstructionProfileFields>, provenance?: FieldProvenanceMap) {
  return {
    id: "org-cp-1",
    verificationStatus: "partially_verified" as const,
    sourceRef: "org src",
    fieldProvenance: provenance ?? null,
    constructionMethod:         null,
    frontOverlayMode:           null,
    carcassThicknessMm:         null,
    drawerBoxThicknessMm:       null,
    drawerBoxJoinery:           null,
    backThicknessMm:            null,
    adjustableShelfThicknessMm: null,
    nailerThicknessMm:          null,
    ...fields,
  };
}
function projectConstructionRow(fields: Partial<ConstructionProfileFields>, provenance?: FieldProvenanceMap) {
  return { ...orgConstructionRow(fields, provenance), id: "proj-cp-1", verificationStatus: "project_specific" as const, sourceRef: "proj src" };
}

describe("mergeProfileFields — construction", () => {
  it("returns null effective for every field when no scope contributes", () => {
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: null },
      { source: "project",      profile: null },
      { source: "room",         profile: null },
      { source: "cabinet",      profile: null },
    ]);
    for (const f of CONSTRUCTION_FIELDS) {
      expect(eff.effective[f]).toBeNull();
    }
    expect(eff.fieldSources).toEqual({});
    expect(eff.profileIds).toEqual({});
  });

  it("only organization contributes → every non-null org field wins", () => {
    const org = orgConstructionRow({
      carcassThicknessMm: 19.05,
      backThicknessMm:    6.35,
      drawerBoxJoinery:   "dovetail",
    });
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
    ]);
    expect(eff.effective.carcassThicknessMm).toBe(19.05);
    expect(eff.effective.backThicknessMm).toBe(6.35);
    expect(eff.effective.drawerBoxJoinery).toBe("dovetail");
    expect(eff.fieldSources.carcassThicknessMm).toBe("organization");
    expect(eff.fieldSources.backThicknessMm).toBe("organization");
    expect(eff.profileIds.organization).toBe("org-cp-1");
  });

  it("project overrides one field, sibling fields still inherit from org (THE BUG-FIX)", () => {
    const org  = orgConstructionRow({
      carcassThicknessMm: 19.05,
      backThicknessMm:    6.35,
      drawerBoxJoinery:   "dovetail",
    });
    const proj = projectConstructionRow({
      constructionMethod: "face_frame",
      frontOverlayMode:   "inset",
    });
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
      { source: "project",      profile: proj },
    ]);
    expect(eff.effective.carcassThicknessMm).toBe(19.05);
    expect(eff.effective.constructionMethod).toBe("face_frame");
    expect(eff.effective.frontOverlayMode).toBe("inset");
    expect(eff.fieldSources.carcassThicknessMm).toBe("organization");
    expect(eff.fieldSources.constructionMethod).toBe("project");
  });

  it("null at higher scope does NOT erase lower-scope value (regression)", () => {
    const org  = orgConstructionRow({ carcassThicknessMm: 19.05 });
    const proj = projectConstructionRow({ carcassThicknessMm: null });
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
      { source: "project",      profile: proj },
    ]);
    expect(eff.effective.carcassThicknessMm).toBe(19.05);
    expect(eff.fieldSources.carcassThicknessMm).toBe("organization");
  });

  it("cabinet overrides room overrides project overrides organization", () => {
    const org  = orgConstructionRow({ drawerBoxJoinery: "confirmat" });
    const proj = projectConstructionRow({ drawerBoxJoinery: "dowel" });
    const room = { ...projectConstructionRow({ drawerBoxJoinery: "biscuit" }), id: "room-cp-1" };
    const cab  = { ...projectConstructionRow({ drawerBoxJoinery: "dovetail" }), id: "cab-cp-1" };
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
      { source: "project",      profile: proj },
      { source: "room",         profile: room },
      { source: "cabinet",      profile: cab },
    ]);
    expect(eff.effective.drawerBoxJoinery).toBe("dovetail");
    expect(eff.fieldSources.drawerBoxJoinery).toBe("cabinet");
  });

  it("does NOT leak metadata / verificationStatus / sourceRef into effective", () => {
    const org = orgConstructionRow({ carcassThicknessMm: 19.05 });
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
    ]);
    const keys = Object.keys(eff.effective);
    expect(keys).not.toContain("verificationStatus");
    expect(keys).not.toContain("sourceRef");
    expect(keys).not.toContain("fieldProvenance");
    expect(keys).not.toContain("id");
  });
});

describe("mergeProfileFields — material (Bearnson slot policy)", () => {
  const org = {
    id: "org-mp-1",
    verificationStatus: "partially_verified" as const,
    sourceRef: null,
    fieldProvenance: null as FieldProvenanceMap | null,
    carcassMaterialSpec:         "Maple Melamine",
    drawerBoxMaterialSpec:       "Baltic birch plywood OR solid maple",
    faceFrameMaterialSpec:       null,
    doorMaterialSpec:            null,
    shelfMaterialSpec:           null,
    backMaterialSpec:            "Maple Melamine G2S",
    adjustableShelfMaterialSpec: "Maple Melamine",
    nailerMaterialSpec:          "Maple Melamine",
  };
  const proj = {
    ...org,
    id: "proj-mp-1",
    verificationStatus: "project_specific" as const,
    carcassMaterialSpec:   "prefinished plywood, maple veneer",
    faceFrameMaterialSpec: "Rustic White Oak",
    doorMaterialSpec:      "Rustic White Oak, Shaker",
    // drawerBoxMaterialSpec / back / shelf / nailer NULL → inherit
    drawerBoxMaterialSpec:       null,
    backMaterialSpec:            null,
    adjustableShelfMaterialSpec: null,
    nailerMaterialSpec:          null,
  };

  it("project overrides carcass/faceFrame/door; other slots inherit from org", () => {
    const eff = mergeProfileFields<CabinetMaterialProfileFields>(MATERIAL_FIELDS, [
      { source: "organization", profile: org },
      { source: "project",      profile: proj },
    ]);
    expect(eff.effective.carcassMaterialSpec).toBe("prefinished plywood, maple veneer");
    expect(eff.effective.faceFrameMaterialSpec).toBe("Rustic White Oak");
    expect(eff.effective.doorMaterialSpec).toBe("Rustic White Oak, Shaker");
    expect(eff.effective.drawerBoxMaterialSpec).toBe("Baltic birch plywood OR solid maple");
    expect(eff.effective.backMaterialSpec).toBe("Maple Melamine G2S");
    expect(eff.effective.nailerMaterialSpec).toBe("Maple Melamine");
    expect(eff.fieldSources.carcassMaterialSpec).toBe("project");
    expect(eff.fieldSources.backMaterialSpec).toBe("organization");
  });
});

describe("mergeProfileFields — hardware (Blum soft-close inheritance)", () => {
  const org = {
    id: "org-hp-1",
    verificationStatus: "partially_verified" as const,
    sourceRef: null,
    fieldProvenance: null as FieldProvenanceMap | null,
    hingeManufacturer:       "Blum",
    hingeSoftClose:          true,
    hingeSystem:             null,
    drawerSlideManufacturer: "Blum",
    drawerSlideSoftClose:    true,
    drawerSlideSystem:       null,
  };
  it("room-level hardware profile overriding hingeSystem does NOT wipe hingeManufacturer / hingeSoftClose", () => {
    const roomHardware = {
      ...org, id: "room-hp-1",
      hingeManufacturer: null,
      hingeSoftClose: null,
      hingeSystem: "Some Custom Room System",
      drawerSlideManufacturer: null,
      drawerSlideSoftClose: null,
      drawerSlideSystem: null,
    };
    const eff = mergeProfileFields<HardwareProfileFields>(HARDWARE_FIELDS, [
      { source: "organization", profile: org },
      { source: "room",         profile: roomHardware },
    ]);
    expect(eff.effective.hingeManufacturer).toBe("Blum");
    expect(eff.effective.hingeSoftClose).toBe(true);
    expect(eff.effective.hingeSystem).toBe("Some Custom Room System");
    expect(eff.fieldSources.hingeManufacturer).toBe("organization");
    expect(eff.fieldSources.hingeSystem).toBe("room");
  });

  it("hingeSoftClose:false at project overrides null at org — verified false is honored", () => {
    const proj = { ...org, id: "proj-hp-1", hingeSoftClose: false };
    const eff = mergeProfileFields<HardwareProfileFields>(HARDWARE_FIELDS, [
      { source: "organization", profile: { ...org, hingeSoftClose: null } },
      { source: "project",      profile: proj },
    ]);
    expect(eff.effective.hingeSoftClose).toBe(false);
    expect(eff.fieldSources.hingeSoftClose).toBe("project");
  });
});

describe("effectiveFieldVerification", () => {
  const APPROVED = "Approved Proposal.pdf";
  const org = orgConstructionRow(
    { carcassThicknessMm: 19.05 },
    { carcassThicknessMm: { status: "verified", sourceRef: APPROVED } },
  );

  it("verified field on partially_verified profile row displays VERIFIED", () => {
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
    ]);
    const fv = effectiveFieldVerification("carcassThicknessMm", eff, {
      organization: { fieldProvenance: org.fieldProvenance },
    });
    expect(fv).toEqual({
      status: "verified",
      profileSource: "organization",
      sourceRef: APPROVED,
    });
  });

  it("field with a value but no provenance entry → UNVERIFIED (safe default)", () => {
    const noProvenance = orgConstructionRow({ backThicknessMm: 6.35 }, {});
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: noProvenance },
    ]);
    const fv = effectiveFieldVerification("backThicknessMm", eff, {
      organization: { fieldProvenance: noProvenance.fieldProvenance },
    });
    expect(fv).toEqual({
      status: "unverified",
      profileSource: "organization",
      sourceRef: null,
    });
  });

  it("field never provided by any scope → UNKNOWN", () => {
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
    ]);
    const fv = effectiveFieldVerification("frontOverlayMode", eff, {
      organization: { fieldProvenance: org.fieldProvenance },
    });
    expect(fv).toEqual({ status: "unknown" });
  });

  it("org-verified field stays VERIFIED when project overrides a sibling", () => {
    const BIBB = "Bibb Layouts";
    const proj = projectConstructionRow(
      { constructionMethod: "face_frame" },
      { constructionMethod: { status: "project_specific", sourceRef: BIBB } },
    );
    const eff = mergeProfileFields<ConstructionProfileFields>(CONSTRUCTION_FIELDS, [
      { source: "organization", profile: org },
      { source: "project",      profile: proj },
    ]);
    const carcass = effectiveFieldVerification("carcassThicknessMm", eff, {
      organization: { fieldProvenance: org.fieldProvenance },
      project:      { fieldProvenance: proj.fieldProvenance },
    });
    const method  = effectiveFieldVerification("constructionMethod", eff, {
      organization: { fieldProvenance: org.fieldProvenance },
      project:      { fieldProvenance: proj.fieldProvenance },
    });
    expect(carcass.status).toBe("verified");
    if (carcass.status !== "unknown") {
      expect(carcass.profileSource).toBe("organization");
      expect(carcass.sourceRef).toBe(APPROVED);
    }
    expect(method.status).toBe("project_specific");
    if (method.status !== "unknown") {
      expect(method.profileSource).toBe("project");
      expect(method.sourceRef).toBe(BIBB);
    }
  });
});

// Suppress unused warning for import used only in typedef.
void ({} as ProfileSource);
