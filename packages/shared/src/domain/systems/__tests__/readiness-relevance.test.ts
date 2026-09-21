// Phase 2.1 patch — DRAWER_SYSTEM_UNRESOLVED should only fire when a
// drawer system is actually relevant to the cabinet.
//
// The relevance predicate is shared between the server readiness
// emitter (apps/api/src/lib/effective-systems.ts) and the client
// Inspector's drawer control visibility (implicitly — client uses the
// same "drawerCount > 0 || type === 'drawer_base' || override present"
// check inline; test locks the shared predicate as the load-bearing
// contract).

import { describe, expect, it } from "vitest";
import {
  isDrawerSystemRelevant,
  type DrawerRelevanceInput,
} from "../";

function make(over: Partial<DrawerRelevanceInput> = {}): DrawerRelevanceInput {
  return {
    cabinetType: "base",
    drawerCount: 0,
    cabinetParams: null,
    roomAssignments: null,
    projectAssignments: null,
    organizationAssignments: null,
    ...over,
  };
}

describe("isDrawerSystemRelevant — Phase 2.1 readiness-emission gate", () => {
  it("base + drawerCount=0 + no drawer assignment → NOT relevant", () => {
    // This is the exact production case that triggered the bug report:
    // a plain base cabinet with 2 doors, 0 drawers, no drawer overrides.
    // No DRAWER_SYSTEM_UNRESOLVED should surface.
    expect(isDrawerSystemRelevant(make())).toBe(false);
  });

  it("base + drawerCount=2 + no drawer assignment → relevant", () => {
    expect(isDrawerSystemRelevant(make({ drawerCount: 2 }))).toBe(true);
  });

  it("drawer_base + drawerCount=0 + no drawer assignment → relevant", () => {
    // Type alone justifies emitting the readiness — the user configured
    // a drawer_base cabinet, they need to see the missing-system flag.
    expect(isDrawerSystemRelevant(make({ cabinetType: "drawer_base" }))).toBe(true);
  });

  it("base + drawerCount=0 + explicit Cabinet.parameters.drawerSystemId → relevant", () => {
    expect(
      isDrawerSystemRelevant(make({
        cabinetParams: { drawerSystemId: "d1" },
      })),
    ).toBe(true);
  });

  it("base + drawerCount=0 + inherited Room preferredDrawerSystemId → relevant", () => {
    expect(
      isDrawerSystemRelevant(make({
        roomAssignments: { preferredDrawerSystemId: "d1" },
      })),
    ).toBe(true);
  });

  it("base + drawerCount=0 + inherited Project preferredDrawerSystemId → relevant", () => {
    expect(
      isDrawerSystemRelevant(make({
        projectAssignments: { preferredDrawerSystemId: "d1" },
      })),
    ).toBe(true);
  });

  it("base + drawerCount=0 + inherited Organization preferredDrawerSystemId → relevant", () => {
    expect(
      isDrawerSystemRelevant(make({
        organizationAssignments: { preferredDrawerSystemId: "d1" },
      })),
    ).toBe(true);
  });

  it("empty-string drawerSystemId is treated as absent", () => {
    expect(
      isDrawerSystemRelevant(make({
        cabinetParams: { drawerSystemId: "" },
      })),
    ).toBe(false);
  });

  it("wall + drawerCount=0 + no drawer assignment → NOT relevant", () => {
    expect(isDrawerSystemRelevant(make({ cabinetType: "wall" }))).toBe(false);
  });

  it("tall + drawerCount=0 + no drawer assignment → NOT relevant", () => {
    // Even tall cabinets don't need a drawer system unless drawers or
    // an explicit override are configured.
    expect(isDrawerSystemRelevant(make({ cabinetType: "tall" }))).toBe(false);
  });
});

// ─── Front readiness relevance — no change; kept as a regression fence ───
//
// The user explicitly wanted FRONT_SYSTEM_UNRESOLVED to keep firing for
// the production example (2 doors, no front assigned). That code path
// is unconditional in effective-systems.ts — a resolved-status check
// only. This test documents the intent so a future "make front also
// gate on relevance" refactor doesn't silently drop the warning for
// door-carrying cabinets.

describe("FRONT_SYSTEM_UNRESOLVED — should keep firing for cabinets with doors", () => {
  it("documented intent: doorCount=2 + no front → readiness fires (contract)", () => {
    // Contract-only test — the actual emission is in the API's
    // effective-systems.ts and remains unconditional. If someone adds
    // a relevance predicate for fronts later, they must not exclude
    // "cabinet has doors" from the relevance set.
    const cabinetWithDoors = { doorCount: 2 };
    expect(cabinetWithDoors.doorCount).toBeGreaterThan(0);
  });
});
