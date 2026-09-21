import { describe, expect, it } from "vitest";
import { applyCabinetParametersPatch, classifyParameterKey, doesParameterChangeRequireCadRecompute } from "../../cabinets";
import { buildInteriorComponentsPatch, type CabinetInteriorComponent } from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 manufacturing-freeze guardrails.
//
// interiorComponents is classified as "metadata" — NO CAD recompute,
// NO consumption in compileUnit / syncParts / DXF / CNC / nesting /
// hardware BOM. Removing a component NEVER decrements legacy counts;
// adding a hidden_drawer NEVER increments drawerCount.
// ═══════════════════════════════════════════════════════════════════════

const c = (id: string, over: Partial<CabinetInteriorComponent> = {}): CabinetInteriorComponent => ({
  id,
  enabled: true,
  type: "spice_rack",
  ...over,
} as CabinetInteriorComponent);

describe("PARAMETER_IMPACT.interiorComponents === 'metadata'", () => {
  it("classifyParameterKey returns 'metadata'", () => {
    expect(classifyParameterKey("interiorComponents")).toBe("metadata");
  });
});

describe("interior-component PATCHes do NOT trigger CAD recompute", () => {
  it("adding a component → no recompute", () => {
    const prev = { doorCount: 2, drawerCount: 4 };
    const next = applyCabinetParametersPatch(prev, {
      interiorComponents: [c("x", { type: "trash_pullout", bins: 2 })],
    });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("removing a component → no recompute", () => {
    const prev = {
      doorCount: 2,
      drawerCount: 4,
      interiorComponents: [c("a"), c("b")],
    };
    const next = applyCabinetParametersPatch(prev, { interiorComponents: [c("b")] });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("clearing all components → no recompute", () => {
    const prev = { doorCount: 2, interiorComponents: [c("a")] };
    const next = applyCabinetParametersPatch(prev, { interiorComponents: [] });
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });

  it("reorder / enable-toggle / edit → no recompute", () => {
    const prev = { doorCount: 2, interiorComponents: [c("a"), c("b")] };
    const next1 = applyCabinetParametersPatch(prev, { interiorComponents: [c("b"), c("a")] });
    expect(doesParameterChangeRequireCadRecompute(prev, next1)).toBe(false);

    const next2 = applyCabinetParametersPatch(prev, {
      interiorComponents: [c("a", { enabled: false }), c("b")],
    });
    expect(doesParameterChangeRequireCadRecompute(prev, next2)).toBe(false);
  });

  it("manufacturing keys (doorCount) still trigger recompute — sanity", () => {
    // Confirms the freeze test isn't accidentally reporting no-recompute
    // for every possible patch.
    const prev = { doorCount: 1 };
    const next = { doorCount: 3 };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(true);
  });
});

describe("No legacy field derivation from interior components", () => {
  it("adding a hidden_drawer does NOT touch drawerCount", () => {
    const prev = { drawerCount: 2 };
    const next = applyCabinetParametersPatch(prev, {
      interiorComponents: [c("x", { type: "hidden_drawer", location: "inside_cabinet" })],
    });
    expect(next.drawerCount).toBe(2);
  });

  it("removing all components does NOT decrement any legacy count", () => {
    const prev = {
      doorCount: 2,
      drawerCount: 4,
      shelfCount: 1,
      interiorComponents: [
        c("a", { type: "trash_pullout", bins: 2 }),
        c("b", { type: "hidden_drawer" }),
      ],
    };
    const next = applyCabinetParametersPatch(prev, { interiorComponents: [] });
    expect(next.doorCount).toBe(2);
    expect(next.drawerCount).toBe(4);
    expect(next.shelfCount).toBe(1);
  });
});

describe("buildInteriorComponentsPatch produces a patch touching only interiorComponents", () => {
  it("patch body has exactly one key inside parameters", () => {
    const patch = buildInteriorComponentsPatch([c("x")]);
    expect(Object.keys(patch.parameters)).toEqual(["interiorComponents"]);
  });
});
