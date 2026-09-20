import { describe, expect, it } from "vitest";
import { applyCabinetParametersPatch, classifyParameterKey } from "../";

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2 additions to Cabinet.parameters:
//   · System refs (familyRuleId, frontSystemId, drawerSystemId) —
//     DELETABLE via `null` in patch.
//   · disableFamilyRule — NOT deletable; canonical form is
//     absence (false) or literal true.
// ═══════════════════════════════════════════════════════════════════════════

describe("applyCabinetParametersPatch — Phase 2 system refs", () => {
  it("PATCH { familyRuleId: 'r1' } sets the key", () => {
    const out = applyCabinetParametersPatch({}, { familyRuleId: "r1" });
    expect(out).toEqual({ familyRuleId: "r1" });
  });

  it("PATCH { familyRuleId: null } DELETES the key", () => {
    const out = applyCabinetParametersPatch({ familyRuleId: "r1" }, { familyRuleId: null });
    expect("familyRuleId" in out).toBe(false);
  });

  it("PATCH absent → preserve", () => {
    const out = applyCabinetParametersPatch({ familyRuleId: "r1" }, {});
    expect(out.familyRuleId).toBe("r1");
  });

  it("frontSystemId + drawerSystemId are also deletable via null", () => {
    const out = applyCabinetParametersPatch(
      { frontSystemId: "f1", drawerSystemId: "d1" },
      { frontSystemId: null, drawerSystemId: null },
    );
    expect("frontSystemId" in out).toBe(false);
    expect("drawerSystemId" in out).toBe(false);
  });
});

describe("applyCabinetParametersPatch — disableFamilyRule canonical form", () => {
  it("PATCH { disableFamilyRule: true } persists true", () => {
    const out = applyCabinetParametersPatch({}, { disableFamilyRule: true });
    expect(out).toEqual({ disableFamilyRule: true });
  });

  it("PATCH { disableFamilyRule: false } REMOVES the key (canonical absence)", () => {
    const out = applyCabinetParametersPatch(
      { disableFamilyRule: true },
      { disableFamilyRule: false },
    );
    expect("disableFamilyRule" in out).toBe(false);
  });

  it("PATCH absent → preserve", () => {
    const out = applyCabinetParametersPatch({ disableFamilyRule: true }, {});
    expect(out.disableFamilyRule).toBe(true);
  });

  it("disableFamilyRule = true coexists with familyRuleId; both persist", () => {
    const out = applyCabinetParametersPatch(
      { familyRuleId: "r1" },
      { disableFamilyRule: true },
    );
    expect(out).toEqual({ familyRuleId: "r1", disableFamilyRule: true });
  });

  it("PATCH { familyRuleId: null } while disableFamilyRule=true → drops only familyRuleId", () => {
    const out = applyCabinetParametersPatch(
      { familyRuleId: "r1", disableFamilyRule: true },
      { familyRuleId: null },
    );
    expect(out).toEqual({ disableFamilyRule: true });
  });
});

describe("PARAMETER_IMPACT classification for Phase 2 keys", () => {
  it("familyRuleId / frontSystemId / drawerSystemId / disableFamilyRule are all 'metadata'", () => {
    expect(classifyParameterKey("familyRuleId")).toBe("metadata");
    expect(classifyParameterKey("frontSystemId")).toBe("metadata");
    expect(classifyParameterKey("drawerSystemId")).toBe("metadata");
    expect(classifyParameterKey("disableFamilyRule")).toBe("metadata");
  });
});
