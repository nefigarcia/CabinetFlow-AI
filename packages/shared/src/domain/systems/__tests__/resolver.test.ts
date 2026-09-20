import { describe, expect, it } from "vitest";
import {
  resolveCabinetFamilyRule,
  resolveDrawerSystem,
  resolveFrontSystem,
  assertSameOrg,
  type CabinetFamilyRuleRow,
  type DrawerSystemRow,
  type FrontSystemRow,
} from "../";

// ─── Fixture builders ──────────────────────────────────────────────────

function baseRule(id: string, orgId = "org1"): CabinetFamilyRuleRow {
  return {
    id, orgId, name: `Rule ${id}`, description: null,
    cabinetType: "base",
    hasToeKick: true, hasBack: true, hasNailer: true,
    fixedShelfPolicy: null, cornerVariant: null,
    toeHeightMm: 101.6, toeRecessMm: 63.5,
    topRevealMm: 6.35, bottomRevealMm: 0,
    topScribeMm: 0, bottomScribeMm: 0,
    verificationStatus: "verified", verificationGaps: null,
    sourceRef: null, fieldProvenance: null, metadata: null,
  };
}

function frontRow(id: string, orgId = "org1"): FrontSystemRow {
  return {
    id, orgId, name: `Front ${id}`, description: null,
    kind: "hinged_double", role: "cabinet_front", glassFlag: false,
    verificationStatus: "verified", verificationGaps: null,
    sourceRef: null, fieldProvenance: null, metadata: null,
  };
}

function drawerRow(id: string, orgId = "org1"): DrawerSystemRow {
  return {
    id, orgId, name: `Drawer ${id}`, description: null,
    kind: "traditional",
    boxSideThicknessMm: 15.875, boxBottomThicknessMm: 6.35,
    boxBackThicknessMm: 15.875, boxSubFrontThicknessMm: 15.875,
    boxJoinery: "dovetail", proprietaryFamily: null,
    verificationStatus: "verified", verificationGaps: null,
    sourceRef: null, fieldProvenance: null, metadata: null,
  };
}

// ─── Family resolver ───────────────────────────────────────────────────

describe("resolveCabinetFamilyRule — hierarchy", () => {
  const org = baseRule("org-rule");
  const project = baseRule("proj-rule");
  const room = baseRule("room-rule");
  const cabinet = baseRule("cab-rule");

  it("1. ORG base assigned + cabinet has no override → org rule resolves", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base", cabinetParams: {},
      cabinetRule: null,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: org,
    });
    expect(out.status).toBe("resolved");
    expect(out.source).toBe("organization");
    expect(out.rule?.id).toBe("org-rule");
  });

  it("2. ORG + cabinet familyRuleId set → cabinet rule wins", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base",
      cabinetParams: { familyRuleId: "cab-rule" },
      cabinetRule: cabinet,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: org,
    });
    expect(out.status).toBe("resolved");
    expect(out.source).toBe("cabinet");
    expect(out.rule?.id).toBe("cab-rule");
  });

  it("3. ORG + cabinet PATCH familyRuleId=null → cabinet override removed → org resolves", () => {
    // After PATCH { familyRuleId: null }, applyCabinetParametersPatch DELETES the key.
    // Simulated here: params bag no longer contains familyRuleId.
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base", cabinetParams: {},
      cabinetRule: null,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: org,
    });
    expect(out.source).toBe("organization");
  });

  it("4. ORG + disableFamilyRule=true → { status: disabled, rule: null }", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base",
      cabinetParams: { disableFamilyRule: true },
      cabinetRule: null,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: org,
    });
    expect(out.status).toBe("disabled");
    expect(out.source).toBe("cabinet_disabled");
    expect(out.rule).toBeNull();
  });

  it("5. disableFamilyRule=true wins over familyRuleId in same params bag", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base",
      cabinetParams: { disableFamilyRule: true, familyRuleId: "cab-rule" },
      cabinetRule: cabinet,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: null,
      roomRule: null, projectRule: null, organizationRule: null,
    });
    expect(out.status).toBe("disabled");
    expect(out.rule).toBeNull();
  });

  it("6. disableFamilyRule=false OR absent → normal inheritance", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base",
      cabinetParams: { disableFamilyRule: false },
      cabinetRule: null,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: org,
    });
    expect(out.source).toBe("organization");
  });

  it("7. ROOM + PROJECT + ORG all assigned → Room wins", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base", cabinetParams: {},
      cabinetRule: null,
      roomAssignments: { familyRuleIdsByCabinetType: { base: "room-rule" } },
      projectAssignments: { familyRuleIdsByCabinetType: { base: "proj-rule" } },
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: room, projectRule: project, organizationRule: org,
    });
    expect(out.source).toBe("room");
    expect(out.rule?.id).toBe("room-rule");
  });

  it("8. disableFamilyRule=true short-circuits — Room/Project NOT consulted", () => {
    // Whether roomRule etc. are present is irrelevant when disabled.
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "base",
      cabinetParams: { disableFamilyRule: true },
      cabinetRule: null,
      roomAssignments: { familyRuleIdsByCabinetType: { base: "room-rule" } },
      projectAssignments: { familyRuleIdsByCabinetType: { base: "proj-rule" } },
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: room, projectRule: project, organizationRule: org,
    });
    expect(out.status).toBe("disabled");
  });

  it("9. Unresolved → status: 'unresolved', source: 'none'", () => {
    const out = resolveCabinetFamilyRule({
      ctxOrgId: "org1", cabinetType: "tall", cabinetParams: {},
      cabinetRule: null,
      roomAssignments: null, projectAssignments: null,
      organizationAssignments: { familyRuleIdsByCabinetType: { base: "org-rule" } },
      roomRule: null, projectRule: null, organizationRule: null,
    });
    expect(out.status).toBe("unresolved");
    expect(out.source).toBe("none");
    expect(out.rule).toBeNull();
  });
});

// ─── Same-org tenancy ──────────────────────────────────────────────────

describe("assertSameOrg — read-time tenancy", () => {
  it("returns row when orgId matches", () => {
    const r = baseRule("x", "org1");
    expect(assertSameOrg(r, "org1")).toBe(r);
  });
  it("returns null when orgId mismatches", () => {
    const r = baseRule("x", "org2");
    expect(assertSameOrg(r, "org1")).toBeNull();
  });
  it("returns null for null/undefined input", () => {
    expect(assertSameOrg(null, "org1")).toBeNull();
    expect(assertSameOrg(undefined, "org1")).toBeNull();
  });
});

// ─── Front / drawer resolvers ─────────────────────────────────────────

describe("resolveFrontSystem — hierarchy", () => {
  it("cabinet frontSystemId wins over all higher scopes", () => {
    const out = resolveFrontSystem({
      ctxOrgId: "org1",
      cabinetParams: { frontSystemId: "cab-front" },
      cabinetSystem:      frontRow("cab-front"),
      roomSystem:         frontRow("room-front"),
      projectSystem:      frontRow("proj-front"),
      organizationSystem: frontRow("org-front"),
    });
    expect(out.status).toBe("resolved");
    expect(out.source).toBe("cabinet");
    expect(out.system?.id).toBe("cab-front");
  });

  it("falls through room → project → organization", () => {
    const out = resolveFrontSystem({
      ctxOrgId: "org1", cabinetParams: {},
      cabinetSystem: null,
      roomSystem: null,
      projectSystem: null,
      organizationSystem: frontRow("org-front"),
    });
    expect(out.source).toBe("organization");
    expect(out.system?.id).toBe("org-front");
  });

  it("no assignment at any scope → unresolved", () => {
    const out = resolveFrontSystem({
      ctxOrgId: "org1", cabinetParams: {},
      cabinetSystem: null, roomSystem: null,
      projectSystem: null, organizationSystem: null,
    });
    expect(out.status).toBe("unresolved");
  });
});

describe("resolveDrawerSystem — hierarchy", () => {
  it("independent of family/front resolution; falls through scopes", () => {
    const out = resolveDrawerSystem({
      ctxOrgId: "org1", cabinetParams: {},
      cabinetSystem: null,
      roomSystem: null,
      projectSystem: drawerRow("proj-drw"),
      organizationSystem: drawerRow("org-drw"),
    });
    expect(out.source).toBe("project");
    expect(out.system?.id).toBe("proj-drw");
  });
});
