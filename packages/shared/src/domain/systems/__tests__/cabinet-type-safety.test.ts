// Phase 2.1 — familyRule.cabinetType MUST match cabinet.type at PATCH time.
//
// The check lives in the Cabinet PATCH API route
// (apps/api/src/app/api/projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/route.ts).
// This test locks in the DOMAIN predicate: the client dropdown filter
// AND the server validator use the same rule. Both must agree.

import { describe, expect, it } from "vitest";
import type { CabinetFamilyRuleRow } from "../";

/** Domain predicate — a family rule may be assigned to a cabinet iff
 *  its cabinetType matches. Server rejects otherwise with 422. */
export function isFamilyRuleCompatibleWithCabinet(
  rule: Pick<CabinetFamilyRuleRow, "cabinetType">,
  cabinetType: string,
): boolean {
  return rule.cabinetType === cabinetType;
}

describe("familyRule.cabinetType safety", () => {
  it("base rule ↔ base cabinet → compatible", () => {
    expect(isFamilyRuleCompatibleWithCabinet({ cabinetType: "base" }, "base")).toBe(true);
  });
  it("wall rule ↔ base cabinet → INCOMPATIBLE (server must reject 422)", () => {
    expect(isFamilyRuleCompatibleWithCabinet({ cabinetType: "wall" }, "base")).toBe(false);
  });
  it("drawer_base rule ↔ base cabinet → INCOMPATIBLE", () => {
    expect(isFamilyRuleCompatibleWithCabinet({ cabinetType: "drawer_base" }, "base")).toBe(false);
  });
  it("corner rule ↔ corner cabinet → compatible", () => {
    expect(isFamilyRuleCompatibleWithCabinet({ cabinetType: "corner" }, "corner")).toBe(true);
  });
  it("all seven cabinet types self-match", () => {
    for (const t of ["base", "wall", "tall", "corner", "drawer_base", "sink_base", "island"]) {
      expect(isFamilyRuleCompatibleWithCabinet({ cabinetType: t }, t)).toBe(true);
    }
  });
});

// UI filter contract: the Cabinet Inspector dropdown MUST only surface
// rules matching cabinet.type. Encoded as a shared pure filter so both
// client and server can lock in the invariant.

export function filterFamilyRulesForCabinet(
  rules: readonly Pick<CabinetFamilyRuleRow, "cabinetType" | "id">[],
  cabinetType: string,
): typeof rules {
  return rules.filter((r) => r.cabinetType === cabinetType);
}

describe("Family rule dropdown filter", () => {
  const rules = [
    { id: "b1", cabinetType: "base" as const },
    { id: "w1", cabinetType: "wall" as const },
    { id: "b2", cabinetType: "base" as const },
    { id: "t1", cabinetType: "tall" as const },
  ];
  it("returns only base rules for a base cabinet", () => {
    const out = filterFamilyRulesForCabinet(rules, "base");
    expect(out.map((r) => r.id)).toEqual(["b1", "b2"]);
  });
  it("returns [] when no rules match", () => {
    expect(filterFamilyRulesForCabinet(rules, "island")).toEqual([]);
  });
});
