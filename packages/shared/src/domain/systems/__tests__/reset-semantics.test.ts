// Phase 2.1 — "Reset cabinet systems to inherited defaults" only touches
// the 4 Phase 2 keys. All other Cabinet.parameters keys are preserved.

import { describe, expect, it } from "vitest";
import { applyCabinetParametersPatch } from "../../cabinets";

// The exact PATCH shape the Reset button sends.
const RESET_PATCH = {
  familyRuleId:      null,
  frontSystemId:     null,
  drawerSystemId:    null,
  disableFamilyRule: false,
};

describe("Reset cabinet systems PATCH — surgical touch", () => {
  it("removes only Phase 2 keys; preserves everything else", () => {
    const existing = {
      doorCount: 2,
      drawerCount: 0,
      shelfCount: 1,
      constructionProfileId: "cp1",
      materialProfileId: "mp1",
      hardwareProfileId: "hp1",
      wallPlacement: { x: 100, y: 200 },
      familyRuleId: "fr1",
      frontSystemId: "fs1",
      drawerSystemId: "ds1",
      disableFamilyRule: true,
      hingeType: "concealed",
      customKey: "keep-me",
    };
    const out = applyCabinetParametersPatch(existing, RESET_PATCH);

    // Phase 2 keys removed
    expect("familyRuleId" in out).toBe(false);
    expect("frontSystemId" in out).toBe(false);
    expect("drawerSystemId" in out).toBe(false);
    expect("disableFamilyRule" in out).toBe(false);

    // Everything else preserved verbatim
    expect(out.doorCount).toBe(2);
    expect(out.drawerCount).toBe(0);
    expect(out.shelfCount).toBe(1);
    expect(out.constructionProfileId).toBe("cp1");
    expect(out.materialProfileId).toBe("mp1");
    expect(out.hardwareProfileId).toBe("hp1");
    expect(out.wallPlacement).toEqual({ x: 100, y: 200 });
    expect(out.hingeType).toBe("concealed");
    expect(out.customKey).toBe("keep-me");
  });

  it("reset is idempotent (already-reset cabinet reset again → no diff)", () => {
    const existing = { doorCount: 2 };
    const out1 = applyCabinetParametersPatch(existing, RESET_PATCH);
    const out2 = applyCabinetParametersPatch(out1, RESET_PATCH);
    expect(out2).toEqual(out1);
    expect(out1).toEqual({ doorCount: 2 });
  });

  it("reset from disabled state re-enables inheritance", () => {
    const existing = { doorCount: 2, disableFamilyRule: true };
    const out = applyCabinetParametersPatch(existing, RESET_PATCH);
    expect("disableFamilyRule" in out).toBe(false);
  });
});
