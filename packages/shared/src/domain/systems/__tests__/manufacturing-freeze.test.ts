// Phase 2 manufacturing-freeze guardrails.
//
// These tests do NOT compile geometry or invoke the CAD service; they
// assert the FROZEN contract at the shared/domain level:
//
//   · Adding Phase 2 system refs (familyRuleId / frontSystemId /
//     drawerSystemId) OR the disableFamilyRule flag to Cabinet.parameters
//     MUST NOT flip any recompute-CAD signal to true.
//   · classifyParameterKey MUST return "metadata" for all Phase 2 keys.
//   · Phase 2 semantic HardwareResolution MUST NOT mutate any input
//     structure.

import { describe, expect, it } from "vitest";
import {
  applyCabinetParametersPatch,
  classifyParameterKey,
  diffParameterKeys,
  doesParameterChangeRequireCadRecompute,
} from "../../cabinets";
import {
  resolveHardwareRequirements,
  type FrontSystemRow,
} from "../";

describe("Manufacturing freeze — Phase 2 parameter classification", () => {
  it("classifyParameterKey('familyRuleId') === 'metadata'", () => {
    expect(classifyParameterKey("familyRuleId")).toBe("metadata");
  });
  it("classifyParameterKey('frontSystemId') === 'metadata'", () => {
    expect(classifyParameterKey("frontSystemId")).toBe("metadata");
  });
  it("classifyParameterKey('drawerSystemId') === 'metadata'", () => {
    expect(classifyParameterKey("drawerSystemId")).toBe("metadata");
  });
  it("classifyParameterKey('disableFamilyRule') === 'metadata'", () => {
    expect(classifyParameterKey("disableFamilyRule")).toBe("metadata");
  });
});

describe("Manufacturing freeze — Phase 2 PATCHes do NOT trigger CAD recompute", () => {
  it("PATCH { familyRuleId: 'r1' } does not require recompute", () => {
    const prev = { doorCount: 2 };
    const next = applyCabinetParametersPatch(prev, { familyRuleId: "r1" });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("PATCH { disableFamilyRule: true } does not require recompute", () => {
    const prev = { doorCount: 2 };
    const next = applyCabinetParametersPatch(prev, { disableFamilyRule: true });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("PATCH { frontSystemId, drawerSystemId } does not require recompute", () => {
    const prev = { doorCount: 2 };
    const next = applyCabinetParametersPatch(prev, {
      frontSystemId: "f1", drawerSystemId: "d1",
    });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("PATCH removing familyRuleId does not require recompute", () => {
    const prev = { doorCount: 2, familyRuleId: "r1" };
    const next = applyCabinetParametersPatch(prev, { familyRuleId: null });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
    expect(diffParameterKeys(prev, next)).toEqual([]); // key removed, not counted
  });

  it("Manufacturing keys (doorCount) still trigger recompute — sanity check", () => {
    const prev = { doorCount: 1 };
    const next = { doorCount: 3 };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(true);
  });
});

describe("resolveHardwareRequirements — pure function, no input mutation", () => {
  const front: FrontSystemRow = {
    id: "f", orgId: "o", name: "Hinged Double", description: null,
    kind: "hinged_double", role: "cabinet_front", glassFlag: false,
    verificationStatus: "verified", verificationGaps: null,
    sourceRef: null, fieldProvenance: null, metadata: null,
  };

  it("does not mutate cabinetParams or effectiveHardware", () => {
    const params = { doorCount: 2 };
    const effHw = { hingeManufacturer: "Blum", hingeSoftClose: true };
    const paramsSnapshot = JSON.stringify(params);
    const effSnapshot = JSON.stringify(effHw);

    resolveHardwareRequirements({
      cabinetType: "base",
      cabinetParams: params,
      frontSystem: front,
      drawerSystem: null,
      effectiveHardware: effHw,
    });

    expect(JSON.stringify(params)).toBe(paramsSnapshot);
    expect(JSON.stringify(effHw)).toBe(effSnapshot);
  });
});
