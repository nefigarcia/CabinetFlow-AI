import { describe, expect, it } from "vitest";
import {
  evaluateInteriorComponentsReadiness,
  type CabinetInteriorComponent,
  type InteriorCabinetContext,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 readiness engine tests.
//
// Codes covered:
//   INTERIOR_COMPONENT_TARGET_UNRESOLVED
//   INTERIOR_COMPONENT_INCOMPATIBLE
//   INTERIOR_COMPONENT_CAPABILITY_DEFERRED  (aggregated, ≤ 1 per cabinet)
//   INTERIOR_COMPONENT_DUPLICATE_CONFLICT
// ═══════════════════════════════════════════════════════════════════════

function ctx(over: Partial<InteriorCabinetContext> = {}): InteriorCabinetContext {
  return {
    cabinetType: "base",
    doorCount: 0,
    drawerCount: 0,
    shelfCount: 0,
    ...over,
  };
}
function comp(overrides: Partial<CabinetInteriorComponent> = {}): CabinetInteriorComponent {
  return {
    id: overrides.id ?? "c1",
    enabled: overrides.enabled ?? true,
    type: overrides.type ?? "spice_rack",
    ...overrides,
  } as CabinetInteriorComponent;
}

const codes = (issues: ReturnType<typeof evaluateInteriorComponentsReadiness>) =>
  issues.map((i) => i.code);

// ─── Compatibility (INCOMPATIBLE code) ────────────────────────────────

describe("INTERIOR_COMPONENT_INCOMPATIBLE", () => {
  it("trash_pullout on wall → INCOMPATIBLE", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "wall" }),
      components: [comp({ type: "trash_pullout", bins: 2 })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
  });

  it("trash_pullout on base → NO INCOMPATIBLE", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "base" }),
      components: [comp({ type: "trash_pullout", bins: 2 })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
  });

  it("sponge_tilt_out on sink_base → NO INCOMPATIBLE", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "sink_base" }),
      components: [comp({ type: "sponge_tilt_out" })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
  });

  it("sponge_tilt_out on base → INCOMPATIBLE", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "base" }),
      components: [comp({ type: "sponge_tilt_out" })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
  });

  it("sink_pullout on non-sink → INCOMPATIBLE", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "base" }),
      components: [comp({ type: "sink_pullout" })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
  });

  it("custom type is compatible with any cabinet", () => {
    for (const cabinetType of ["base", "wall", "tall", "corner", "sink_base", "drawer_base", "island"] as const) {
      const issues = evaluateInteriorComponentsReadiness({
        cabinet: ctx({ cabinetType }),
        components: [comp({ type: "custom", label: "Custom item" }) as CabinetInteriorComponent],
      });
      expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_INCOMPATIBLE");
    }
  });
});

// ─── TARGET_UNRESOLVED ───────────────────────────────────────────────

describe("INTERIOR_COMPONENT_TARGET_UNRESOLVED", () => {
  it("utensil_divider without target → TARGET_UNRESOLVED", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 2 }),
      components: [comp({ type: "utensil_divider" })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("knife_organizer with cabinet target → TARGET_UNRESOLVED (must be drawer)", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 2 }),
      components: [comp({ type: "knife_organizer", target: { kind: "cabinet" } })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("drawer_divider with valid drawer target → NO warning", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 3 }),
      components: [comp({ type: "drawer_divider", target: { kind: "drawer", index: 1 } })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("drawer target index >= drawerCount → TARGET_UNRESOLVED", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 2 }),
      components: [comp({ type: "utensil_divider", target: { kind: "drawer", index: 5 } })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("drawer count decrease leaves component + emits TARGET_UNRESOLVED", () => {
    // Simulate: cabinet used to have 4 drawers; drawerCount changed to 2.
    // Component targeting drawer 3 should STAY (not silently deleted)
    // and produce the warning.
    const component = comp({
      id: "keep-me",
      type: "utensil_divider",
      target: { kind: "drawer", index: 3 },
    });
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 2 }),
      components: [component],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
    // The component itself is NEVER mutated by the engine.
    expect(component.id).toBe("keep-me");
  });

  it("door index in range → NO warning", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ doorCount: 2 }),
      components: [comp({ type: "spice_rack", target: { kind: "door", index: 1 } })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("shelf index out of range → TARGET_UNRESOLVED", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ shelfCount: 1 }),
      components: [comp({ type: "spice_rack", target: { kind: "shelf", index: 2 } })],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });

  it("disabled components are ignored", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 0 }),
      components: [comp({ type: "utensil_divider", enabled: false })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_TARGET_UNRESOLVED");
  });
});

// ─── CAPABILITY_DEFERRED (aggregate) ─────────────────────────────────

describe("INTERIOR_COMPONENT_CAPABILITY_DEFERRED — aggregated", () => {
  it("no components → no CAPABILITY_DEFERRED", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx(),
      components: [],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_CAPABILITY_DEFERRED");
  });

  it("one component → EXACTLY one CAPABILITY_DEFERRED", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx(),
      components: [comp({ type: "spice_rack" })],
    });
    const aggregated = issues.filter((i) => i.code === "INTERIOR_COMPONENT_CAPABILITY_DEFERRED");
    expect(aggregated.length).toBe(1);
  });

  it("many components across types → still exactly ONE CAPABILITY_DEFERRED with combined detail", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "island", drawerCount: 4 }),
      components: [
        comp({ id: "1", type: "trash_pullout", bins: 2 }),
        comp({ id: "2", type: "hidden_drawer" }),
        comp({ id: "3", type: "sponge_tilt_out" }),
        comp({ id: "4", type: "trash_pullout", bins: 1 }),
      ],
    });
    const aggregated = issues.filter((i) => i.code === "INTERIOR_COMPONENT_CAPABILITY_DEFERRED");
    expect(aggregated.length).toBe(1);
    // Combined detail lists UNIQUE types.
    expect(aggregated[0]!.detail).toContain("trash_pullout");
    expect(aggregated[0]!.detail).toContain("hidden_drawer");
    expect(aggregated[0]!.detail).toContain("sponge_tilt_out");
  });

  it("disabled components skipped in aggregate", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx(),
      components: [comp({ type: "spice_rack", enabled: false })],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_CAPABILITY_DEFERRED");
  });
});

// ─── DUPLICATE_CONFLICT ──────────────────────────────────────────────

describe("INTERIOR_COMPONENT_DUPLICATE_CONFLICT", () => {
  it("two components sharing (drawer, index=0) → DUPLICATE_CONFLICT", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 4 }),
      components: [
        comp({ id: "1", type: "utensil_divider", target: { kind: "drawer", index: 0 } }),
        comp({ id: "2", type: "knife_organizer", target: { kind: "drawer", index: 0 } }),
      ],
    });
    expect(codes(issues)).toContain("INTERIOR_COMPONENT_DUPLICATE_CONFLICT");
  });

  it("same-target components ONE enabled + ONE disabled → no conflict", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ drawerCount: 4 }),
      components: [
        comp({ id: "1", type: "utensil_divider", target: { kind: "drawer", index: 0 } }),
        comp({ id: "2", type: "knife_organizer", target: { kind: "drawer", index: 0 }, enabled: false }),
      ],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_DUPLICATE_CONFLICT");
  });

  it("multiple cabinet-scoped components (kind:cabinet) do NOT conflict (whole cabinet is one target)", () => {
    // cabinet target is a whole-cabinet slot — many trash pullouts of
    // different variants sharing "cabinet" is not a duplicate.
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "island" }),
      components: [
        comp({ id: "1", type: "trash_pullout", bins: 1, target: { kind: "cabinet" } }),
        comp({ id: "2", type: "hidden_drawer", target: { kind: "cabinet" } }),
      ],
    });
    expect(codes(issues)).not.toContain("INTERIOR_COMPONENT_DUPLICATE_CONFLICT");
  });
});

// ─── Systems readiness is SEPARATE ────────────────────────────────────

describe("Interior readiness is its own domain (not mixed with Phase 2 systemsReadiness)", () => {
  it("evaluator only returns INTERIOR_COMPONENT_* codes", () => {
    const issues = evaluateInteriorComponentsReadiness({
      cabinet: ctx({ cabinetType: "island" }),
      components: [
        comp({ id: "1", type: "trash_pullout", bins: 2 }),
        comp({ id: "2", type: "utensil_divider" }),
      ],
    });
    for (const i of issues) {
      expect(i.code.startsWith("INTERIOR_COMPONENT_")).toBe(true);
      expect(i.severity).toBe("warning");
    }
  });
});
