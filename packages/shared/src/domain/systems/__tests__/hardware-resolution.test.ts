import { describe, expect, it } from "vitest";
import {
  resolveHardwareRequirements,
  type DrawerSystemRow,
  type FrontSystemRow,
  type HardwareResolutionInput,
} from "../";

const hingedDouble: FrontSystemRow = {
  id: "f-hd", orgId: "org1", name: "Hinged Double", description: null,
  kind: "hinged_double", role: "cabinet_front", glassFlag: false,
  verificationStatus: "verified", verificationGaps: null,
  sourceRef: null, fieldProvenance: null, metadata: null,
};

const traditionalDrawer: DrawerSystemRow = {
  id: "d-trad", orgId: "org1", name: "Traditional Drawer", description: null,
  kind: "traditional",
  boxSideThicknessMm: 15.875, boxBottomThicknessMm: 6.35,
  boxBackThicknessMm: 15.875, boxSubFrontThicknessMm: 15.875,
  boxJoinery: "dovetail", proprietaryFamily: null,
  verificationStatus: "verified", verificationGaps: null,
  sourceRef: null, fieldProvenance: null, metadata: null,
};

const legrabox: DrawerSystemRow = {
  id: "d-lb", orgId: "org1", name: "Blum Legrabox", description: null,
  kind: "proprietary",
  boxSideThicknessMm: null, boxBottomThicknessMm: null,
  boxBackThicknessMm: null, boxSubFrontThicknessMm: null,
  boxJoinery: null, proprietaryFamily: "Blum Legrabox",
  verificationStatus: "verified", verificationGaps: null,
  sourceRef: null, fieldProvenance: null, metadata: null,
};

const bearnsonHardware = {
  hingeManufacturer: "Blum",
  hingeSoftClose: true,
  drawerSlideManufacturer: "Blum",
  drawerSlideSoftClose: true,
};

// ─── Fixture A — KlintBase11 (2 door + false-front drawer) ─────────────
describe("Fixture A — KlintBase11: 2-door base + 1 false-front drawer", () => {
  const input: HardwareResolutionInput = {
    cabinetType: "base",
    cabinetParams: { doorCount: 2, drawerCount: 0 }, // drawer front is false-front → drawerCount 0 semantically
    frontSystem: hingedDouble,
    drawerSystem: null,
    effectiveHardware: bearnsonHardware,
  };

  it("emits hinge×4 piece verified with softClose", () => {
    const out = resolveHardwareRequirements(input);
    const h = out.requirements.find((r) => r.category === "hinge");
    expect(h).toBeDefined();
    expect(h?.quantity).toBe(4);
    expect(h?.unit).toBe("piece");
    expect(h?.quantityStatus).toBe("verified");
    expect(h?.requirements.softClose).toBe(true);
    expect(h?.familyHint).toBe("Blum");
  });

  it("emits hinge_plate deferred as category='other' with spec.unmodeledCategory", () => {
    const out = resolveHardwareRequirements(input);
    const hp = out.requirements.find(
      (r) => r.category === "other" && r.spec.unmodeledCategory === "hinge_plate",
    );
    expect(hp).toBeDefined();
    expect(hp?.quantity).toBe(4);
    expect(hp?.unit).toBe("piece");
    expect(out.readiness.some((r) => r.code === "SYSTEM_CAPABILITY_DEFERRED")).toBe(true);
  });

  it("emits handle×2 piece verified", () => {
    const out = resolveHardwareRequirements(input);
    const h = out.requirements.find((r) => r.category === "handle");
    expect(h?.quantity).toBe(2);
    expect(h?.unit).toBe("piece");
  });
});

// ─── Fixture B — KlintStdUpper17 (2 doors) ────────────────────────────
describe("Fixture B — KlintStdUpper17: 2-door wall", () => {
  const input: HardwareResolutionInput = {
    cabinetType: "wall",
    cabinetParams: { doorCount: 2 },
    frontSystem: hingedDouble,
    drawerSystem: null,
    effectiveHardware: bearnsonHardware,
  };

  it("hinges = 4 piece + plates = 4 piece + handles = 2 piece", () => {
    const out = resolveHardwareRequirements(input);
    expect(out.requirements.find((r) => r.category === "hinge")?.quantity).toBe(4);
    expect(
      out.requirements.find((r) => r.category === "other" && r.spec.unmodeledCategory === "hinge_plate")?.quantity,
    ).toBe(4);
    expect(out.requirements.find((r) => r.category === "handle")?.quantity).toBe(2);
    expect(out.deferred).toBe(false);
  });
});

// ─── Fixture C — HawkesDrawerBase241 (4 traditional drawers) ──────────
describe("Fixture C — HawkesDrawerBase241: 4-drawer traditional base", () => {
  const input: HardwareResolutionInput = {
    cabinetType: "drawer_base",
    cabinetParams: { doorCount: 0, drawerCount: 4 },
    frontSystem: null,
    drawerSystem: traditionalDrawer,
    effectiveHardware: bearnsonHardware,
  };

  it("drawer_slide × 4 PAIR verified (preserves 'P' source wording)", () => {
    const out = resolveHardwareRequirements(input);
    const s = out.requirements.find((r) => r.category === "drawer_slide");
    expect(s).toBeDefined();
    expect(s?.quantity).toBe(4);
    expect(s?.unit).toBe("pair"); // NOT expanded to 8 pieces
    expect(s?.quantityStatus).toBe("verified");
    expect(s?.requirements.softClose).toBe(true);
  });

  it("handle × 4 piece verified", () => {
    const out = resolveHardwareRequirements(input);
    expect(out.requirements.find((r) => r.category === "handle")?.quantity).toBe(4);
  });

  it("no hinge requirement for a pure-drawer cabinet", () => {
    const out = resolveHardwareRequirements(input);
    expect(out.requirements.find((r) => r.category === "hinge")).toBeUndefined();
  });
});

// ─── Proprietary drawer familyHint ────────────────────────────────────
describe("Legrabox — familyHint reflects proprietaryFamily", () => {
  it("drawer_slide familyHint = 'Blum Legrabox'", () => {
    const out = resolveHardwareRequirements({
      cabinetType: "drawer_base",
      cabinetParams: { drawerCount: 4 },
      frontSystem: null,
      drawerSystem: legrabox,
      effectiveHardware: bearnsonHardware,
    });
    const s = out.requirements.find((r) => r.category === "drawer_slide");
    expect(s?.familyHint).toBe("Blum Legrabox");
    expect(s?.spec.proprietaryFamily).toBe("Blum Legrabox");
  });
});

// ─── Blind corner deferral ────────────────────────────────────────────
describe("Blind corner — hardware resolution deferred", () => {
  it("cornerVariant='blind_left' → deferred, no requirements", () => {
    const out = resolveHardwareRequirements({
      cabinetType: "corner",
      cabinetParams: { doorCount: 1 },
      frontSystem: hingedDouble,
      drawerSystem: null,
      effectiveHardware: bearnsonHardware,
      cabinetFamilyRule: { cornerVariant: "blind_left" },
    });
    expect(out.deferred).toBe(true);
    expect(out.deferReason).toBe("blind_corner_hardware_deferred");
    expect(out.requirements).toEqual([]);
  });
});

// ─── HARDWARE_QUANTITY_UNRESOLVED — non-hinged front with doors ───────
describe("Non-hinged front + doorCount>0 → hinge quantity unresolved", () => {
  const openFront: FrontSystemRow = {
    id: "f-open", orgId: "org1", name: "Open", description: null,
    kind: "open", role: "cabinet_front", glassFlag: false,
    verificationStatus: "verified", verificationGaps: null,
    sourceRef: null, fieldProvenance: null, metadata: null,
  };

  it("emits unresolved hinge + readiness code", () => {
    const out = resolveHardwareRequirements({
      cabinetType: "base",
      cabinetParams: { doorCount: 1 },
      frontSystem: openFront,
      drawerSystem: null,
      effectiveHardware: bearnsonHardware,
    });
    const h = out.requirements.find((r) => r.category === "hinge");
    expect(h?.quantityStatus).toBe("unresolved");
    expect(out.readiness.some((r) => r.code === "HARDWARE_QUANTITY_UNRESOLVED")).toBe(true);
  });
});
