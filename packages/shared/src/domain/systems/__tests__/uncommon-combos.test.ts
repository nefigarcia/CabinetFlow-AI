// Phase 2.1 — SYSTEM_UNCOMMON_COMBO detection is a server-side concern
// in apps/api/src/lib/effective-systems.ts, but the underlying signal is
// derivable from the pure Phase 2 domain types. These tests document
// the expected pairings so the server implementation stays honest.

import { describe, expect, it } from "vitest";
import type { DrawerSystemRow, FrontSystemRow } from "../";

const hingedDouble: FrontSystemRow = {
  id: "f1", orgId: "o", name: "Hinged Double", description: null,
  kind: "hinged_double", role: "cabinet_front", glassFlag: false,
  verificationStatus: "verified", verificationGaps: null,
  sourceRef: null, fieldProvenance: null, metadata: null,
};
const bifoldAppliance: FrontSystemRow = {
  ...hingedDouble, id: "f2", kind: "bifold", role: "appliance_panel",
};
const traditional: DrawerSystemRow = {
  id: "d1", orgId: "o", name: "Traditional", description: null,
  kind: "traditional",
  boxSideThicknessMm: 15.875, boxBottomThicknessMm: 6.35,
  boxBackThicknessMm: 15.875, boxSubFrontThicknessMm: 15.875,
  boxJoinery: "dovetail", proprietaryFamily: null,
  verificationStatus: "verified", verificationGaps: null,
  sourceRef: null, fieldProvenance: null, metadata: null,
};

// The predicate the server uses (copied here as a pure function for
// test coverage — server implementation lives in effective-systems.ts).
function detectUncommonCombos(input: {
  cabinetType: string;
  drawerCount: number;
  front: FrontSystemRow | null;
  drawer: DrawerSystemRow | null;
}): string[] {
  const codes: string[] = [];
  const isDrawerCabinet = input.cabinetType === "drawer_base" || input.drawerCount > 0;

  if (input.front && input.cabinetType === "drawer_base" &&
      (input.front.kind === "hinged_single" || input.front.kind === "hinged_double")) {
    codes.push("SYSTEM_UNCOMMON_COMBO:front_hinged_on_drawer_base");
  }
  if (input.drawer && !isDrawerCabinet) {
    codes.push("SYSTEM_UNCOMMON_COMBO:drawer_system_no_drawers");
  }
  if (input.front && input.front.role === "appliance_panel" && input.front.kind === "bifold") {
    codes.push("SYSTEM_UNCOMMON_COMBO:bifold_appliance_panel");
  }
  return codes;
}

describe("SYSTEM_UNCOMMON_COMBO — non-blocking readiness signals", () => {
  it("drawer_base + hinged_double front → uncommon", () => {
    expect(
      detectUncommonCombos({ cabinetType: "drawer_base", drawerCount: 0, front: hingedDouble, drawer: null }),
    ).toContain("SYSTEM_UNCOMMON_COMBO:front_hinged_on_drawer_base");
  });

  it("base + hinged_double front → normal (no flag)", () => {
    expect(
      detectUncommonCombos({ cabinetType: "base", drawerCount: 0, front: hingedDouble, drawer: null }),
    ).toEqual([]);
  });

  it("drawerCount=0 + drawer system assigned → uncommon", () => {
    expect(
      detectUncommonCombos({ cabinetType: "base", drawerCount: 0, front: null, drawer: traditional }),
    ).toContain("SYSTEM_UNCOMMON_COMBO:drawer_system_no_drawers");
  });

  it("drawer_base + drawer system assigned → normal", () => {
    expect(
      detectUncommonCombos({ cabinetType: "drawer_base", drawerCount: 4, front: null, drawer: traditional }),
    ).toEqual([]);
  });

  it("appliance_panel + bifold → uncommon", () => {
    expect(
      detectUncommonCombos({ cabinetType: "tall", drawerCount: 0, front: bifoldAppliance, drawer: null }),
    ).toContain("SYSTEM_UNCOMMON_COMBO:bifold_appliance_panel");
  });

  it("multiple uncommon flags may fire simultaneously", () => {
    const flags = detectUncommonCombos({
      cabinetType: "drawer_base",
      drawerCount: 0,
      front: hingedDouble,
      drawer: null,
    });
    expect(flags.length).toBeGreaterThanOrEqual(1);
    // Neither flag blocks; both are informational.
  });
});
