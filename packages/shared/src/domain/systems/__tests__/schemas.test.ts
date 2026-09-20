import { describe, expect, it } from "vitest";
import {
  cabinetFamilyRuleCreateSchema,
  cabinetFamilyRulePatchSchema,
  drawerSystemCreateSchema,
  drawerSystemPatchSchema,
  frontSystemCreateSchema,
  frontSystemPatchSchema,
  buildDrawerSystemCandidate,
} from "../";

describe("CabinetFamilyRule schemas", () => {
  const validFull = {
    cabinetType: "base" as const,
    name: "Bearnson Standard Base V1",
    hasToeKick: true,
    hasBack: true,
    hasNailer: true,
    toeHeightMm: 101.6,
    toeRecessMm: 63.5,
    topRevealMm: 6.35,
    bottomRevealMm: 0,
    topScribeMm: 0,
    bottomScribeMm: 0,
  };

  it("CREATE accepts a fully-populated row", () => {
    expect(cabinetFamilyRuleCreateSchema.safeParse(validFull).success).toBe(true);
  });

  it("CREATE requires cabinetType and name", () => {
    expect(cabinetFamilyRuleCreateSchema.safeParse({ ...validFull, cabinetType: undefined }).success).toBe(false);
    expect(cabinetFamilyRuleCreateSchema.safeParse({ ...validFull, name: "" }).success).toBe(false);
  });

  it("CREATE rejects negative dimensions but accepts 0", () => {
    expect(cabinetFamilyRuleCreateSchema.safeParse({ ...validFull, toeHeightMm: -1 }).success).toBe(false);
    expect(cabinetFamilyRuleCreateSchema.safeParse({ ...validFull, toeHeightMm: 0 }).success).toBe(true);
  });

  it("CREATE rejects unknown cabinetType", () => {
    expect(cabinetFamilyRuleCreateSchema.safeParse({ ...validFull, cabinetType: "unknown" as never }).success).toBe(false);
  });

  it("PATCH accepts three-state per dimension field", () => {
    expect(cabinetFamilyRulePatchSchema.safeParse({ toeHeightMm: 101.6 }).success).toBe(true);
    expect(cabinetFamilyRulePatchSchema.safeParse({ toeHeightMm: null }).success).toBe(true);
    expect(cabinetFamilyRulePatchSchema.safeParse({}).success).toBe(true);
  });
});

describe("FrontSystem schemas", () => {
  const valid = {
    name: "Bearnson Hinged Single",
    kind: "hinged_single" as const,
    role: "cabinet_front" as const,
    glassFlag: false,
  };

  it("CREATE accepts valid kinds", () => {
    for (const kind of ["hinged_single", "hinged_double", "bifold", "pocket", "open", "fixed_panel"] as const) {
      expect(frontSystemCreateSchema.safeParse({ ...valid, kind }).success).toBe(true);
    }
  });

  it("CREATE rejects unknown kind", () => {
    expect(frontSystemCreateSchema.safeParse({ ...valid, kind: "made_up" as never }).success).toBe(false);
  });

  it("kind + role + glassFlag are orthogonal", () => {
    // Any combination of kind / role / glassFlag is schema-valid; oddities
    // are surfaced via a readiness code at the resolver, not the schema.
    expect(
      frontSystemCreateSchema.safeParse({ ...valid, kind: "bifold", role: "appliance_panel", glassFlag: true }).success,
    ).toBe(true);
  });

  it("PATCH accepts empty partial", () => {
    expect(frontSystemPatchSchema.safeParse({}).success).toBe(true);
  });
});

describe("DrawerSystem discriminated union — CREATE", () => {
  const traditional = {
    kind: "traditional" as const,
    name: "Bearnson Traditional Drawer V1",
    boxSideThicknessMm: 15.875,
    boxBottomThicknessMm: 6.35,
    boxBackThicknessMm: 15.875,
    boxSubFrontThicknessMm: 15.875,
    boxJoinery: "dovetail" as const,
  };
  const proprietary = {
    kind: "proprietary" as const,
    name: "Bearnson Blum Legrabox",
    proprietaryFamily: "Blum Legrabox",
  };

  it("accepts a valid traditional row", () => {
    expect(drawerSystemCreateSchema.safeParse(traditional).success).toBe(true);
  });

  it("accepts a valid proprietary row", () => {
    expect(drawerSystemCreateSchema.safeParse(proprietary).success).toBe(true);
  });

  it("rejects traditional row with proprietaryFamily set", () => {
    const bad = { ...traditional, proprietaryFamily: "Blum Legrabox" };
    expect(drawerSystemCreateSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects proprietary row with box thickness set", () => {
    const bad = { ...proprietary, boxSideThicknessMm: 15.875 };
    expect(drawerSystemCreateSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects proprietary row missing proprietaryFamily", () => {
    const bad = { kind: "proprietary" as const, name: "no family" };
    expect(drawerSystemCreateSchema.safeParse(bad).success).toBe(false);
  });
});

describe("DrawerSystem — PATCH + candidate-state validation", () => {
  const existingTraditional = {
    kind: "traditional" as const,
    name: "Bearnson Traditional Drawer V1",
    description: null,
    boxSideThicknessMm: 15.875,
    boxBottomThicknessMm: 6.35,
    boxBackThicknessMm: 15.875,
    boxSubFrontThicknessMm: 15.875,
    boxJoinery: "dovetail" as never,
    proprietaryFamily: null,
  };

  it("PATCH parses a permissive partial", () => {
    expect(drawerSystemPatchSchema.safeParse({ boxBottomThicknessMm: 6.35 }).success).toBe(true);
  });

  it("PATCH { kind: 'proprietary' } WITHOUT stripping traditional fields → candidate fails CREATE", () => {
    const parsed = drawerSystemPatchSchema.safeParse({ kind: "proprietary", proprietaryFamily: "Blum Legrabox" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const candidate = buildDrawerSystemCandidate({
      existing: existingTraditional,
      patch: parsed.data,
    });
    // candidate is proprietary but still carries boxSideThicknessMm from existing.
    // CREATE schema must reject this.
    expect(drawerSystemCreateSchema.safeParse(candidate).success).toBe(false);
  });

  it("PATCH transition traditional→proprietary WITH stripping succeeds", () => {
    const parsed = drawerSystemPatchSchema.safeParse({
      kind: "proprietary",
      proprietaryFamily: "Blum Legrabox",
      boxSideThicknessMm: null,
      boxBottomThicknessMm: null,
      boxBackThicknessMm: null,
      boxSubFrontThicknessMm: null,
      boxJoinery: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const candidate = buildDrawerSystemCandidate({
      existing: existingTraditional,
      patch: parsed.data,
    });
    expect(drawerSystemCreateSchema.safeParse(candidate).success).toBe(true);
  });

  it("PATCH transition proprietary→traditional WITH stripping succeeds", () => {
    const existingProprietary = {
      kind: "proprietary" as const,
      name: "Bearnson Blum Legrabox",
      description: null,
      boxSideThicknessMm: null,
      boxBottomThicknessMm: null,
      boxBackThicknessMm: null,
      boxSubFrontThicknessMm: null,
      boxJoinery: null,
      proprietaryFamily: "Blum Legrabox",
    };
    const parsed = drawerSystemPatchSchema.safeParse({
      kind: "traditional",
      proprietaryFamily: null,
      boxSideThicknessMm: 15.875,
      boxBottomThicknessMm: 6.35,
      boxBackThicknessMm: 15.875,
      boxSubFrontThicknessMm: 15.875,
      boxJoinery: "dovetail",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const candidate = buildDrawerSystemCandidate({
      existing: existingProprietary,
      patch: parsed.data,
    });
    expect(drawerSystemCreateSchema.safeParse(candidate).success).toBe(true);
  });

  it("PATCH proprietary→traditional WITHOUT clearing proprietaryFamily → candidate rejected", () => {
    const existingProprietary = {
      kind: "proprietary" as const,
      name: "Bearnson Blum Legrabox",
      description: null,
      boxSideThicknessMm: null,
      boxBottomThicknessMm: null,
      boxBackThicknessMm: null,
      boxSubFrontThicknessMm: null,
      boxJoinery: null,
      proprietaryFamily: "Blum Legrabox",
    };
    const parsed = drawerSystemPatchSchema.safeParse({
      kind: "traditional",
      boxSideThicknessMm: 15.875,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const candidate = buildDrawerSystemCandidate({
      existing: existingProprietary,
      patch: parsed.data,
    });
    expect(drawerSystemCreateSchema.safeParse(candidate).success).toBe(false);
  });
});
