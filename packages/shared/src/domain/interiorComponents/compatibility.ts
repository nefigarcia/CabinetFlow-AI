// Phase 3.0 compatibility + target validation engine.
//
// Pure deterministic function of (component, cabinetContext). NEVER
// mutates state. Emits readiness issues in the shape the effective-
// systems endpoint exposes via the SEPARATE `interiorReadiness` field
// (never merged into Phase 2 systemsReadiness — that is a hard rule).
//
// CAPABILITY_DEFERRED is aggregated to ONE issue per cabinet whose
// detail lists the unique component types intentionally unmodeled in
// Phase 3.0. Target / incompatibility / duplicate issues remain
// per-component.

import type {
  CabinetInteriorComponent,
  InteriorCabinetContext,
  InteriorComponentType,
  InteriorReadinessIssue,
} from "./types";

// ─── Compatibility matrix ───────────────────────────────────────────

/** For each component type, the set of cabinet types where it's
 *  considered a NORMAL choice. Anything outside this set fires
 *  INTERIOR_COMPONENT_INCOMPATIBLE (warning, not blocker). Types not
 *  listed here (e.g. "custom") are compatible with every cabinet. */
const COMPATIBLE_TYPES: Partial<Record<InteriorComponentType, ReadonlySet<string>>> = {
  rollout: new Set(["base", "tall", "sink_base", "drawer_base", "island"]),
  trash_pullout: new Set(["base", "sink_base", "island"]),
  tray_divider: new Set(["base", "tall", "wall"]),
  spice_rack: new Set(["base", "wall", "tall", "sink_base"]),
  hidden_drawer: new Set(["base", "drawer_base", "sink_base", "island", "tall"]),
  sink_pullout: new Set(["sink_base"]),
  sponge_tilt_out: new Set(["sink_base"]),
  // knife_organizer / utensil_divider / drawer_divider are compatible with
  // any cabinet type; their real constraint is requiring a drawer target
  // (see REQUIRES_DRAWER_TARGET below).
};

/** Types that MUST target a drawer to be meaningful. Missing target
 *  or non-drawer target → TARGET_UNRESOLVED. */
const REQUIRES_DRAWER_TARGET: ReadonlySet<InteriorComponentType> = new Set([
  "knife_organizer",
  "utensil_divider",
  "drawer_divider",
]);

// ─── The engine ─────────────────────────────────────────────────────

/** Runs the full readiness pass over a cabinet's interior components.
 *  Deterministic — the same input always yields the same set of
 *  issues in the same order. */
export function evaluateInteriorComponentsReadiness(input: {
  cabinet: InteriorCabinetContext;
  components: readonly CabinetInteriorComponent[];
}): InteriorReadinessIssue[] {
  const issues: InteriorReadinessIssue[] = [];
  const deferredTypes = new Set<InteriorComponentType>();

  // Per-component analysis.
  for (const c of input.components) {
    if (!c.enabled) continue;                          // disabled → skip semantic checks

    // 1. INCOMPATIBLE — cabinet type outside the compatible set.
    const compatSet = COMPATIBLE_TYPES[c.type];
    if (compatSet && !compatSet.has(input.cabinet.cabinetType)) {
      issues.push({
        code: "INTERIOR_COMPONENT_INCOMPATIBLE",
        severity: "warning",
        detail: `${humanTypeName(c.type)} is unusual on a ${humanCabinetType(
          input.cabinet.cabinetType,
        )} cabinet.`,
        componentIds: [c.id],
      });
    }

    // 2. TARGET_UNRESOLVED — required target missing, or index OOB.
    const targetIssue = evaluateTarget(c, input.cabinet);
    if (targetIssue) issues.push(targetIssue);

    // 3. CAPABILITY_DEFERRED — aggregate at the end. Every non-custom
    //    type is intentionally unmodeled at the manufacturing layer in
    //    Phase 3.0. `custom` is user-defined and inherently deferred.
    deferredTypes.add(c.type);
  }

  // 4. DUPLICATE_CONFLICT — two enabled components sharing the same
  //    (kind, index) target where kind is drawer/door/shelf.
  const targetKeys = new Map<string, string[]>();
  for (const c of input.components) {
    if (!c.enabled) continue;
    if (!c.target) continue;
    if (c.target.kind === "cabinet") continue;
    const key = `${c.target.kind}:${c.target.index}`;
    const arr = targetKeys.get(key) ?? [];
    arr.push(c.id);
    targetKeys.set(key, arr);
  }
  for (const [key, ids] of targetKeys) {
    if (ids.length <= 1) continue;
    const [kind, indexStr] = key.split(":");
    const humanIndex = Number(indexStr) + 1; // UI convention: 1-based
    issues.push({
      code: "INTERIOR_COMPONENT_DUPLICATE_CONFLICT",
      severity: "warning",
      detail: `${ids.length} components share the same ${kind} ${humanIndex} target.`,
      componentIds: ids,
    });
  }

  // 5. Aggregate CAPABILITY_DEFERRED — one issue per cabinet.
  if (deferredTypes.size > 0) {
    const sorted = Array.from(deferredTypes).sort();
    issues.push({
      code: "INTERIOR_COMPONENT_CAPABILITY_DEFERRED",
      severity: "warning",
      detail: `Manufacturing implementation deferred for: ${sorted.join(", ")}.`,
      componentIds: [],
    });
  }

  return issues;
}

// ─── Helpers ────────────────────────────────────────────────────────

function evaluateTarget(
  c: CabinetInteriorComponent,
  ctx: InteriorCabinetContext,
): InteriorReadinessIssue | null {
  const needsDrawer = REQUIRES_DRAWER_TARGET.has(c.type);

  if (needsDrawer) {
    if (!c.target || c.target.kind !== "drawer") {
      return {
        code: "INTERIOR_COMPONENT_TARGET_UNRESOLVED",
        severity: "warning",
        detail: `${humanTypeName(c.type)} requires a drawer target.`,
        componentIds: [c.id],
      };
    }
  }

  if (!c.target) return null;

  // Index-based targets: verify the index is in range for the current
  // cabinet intent.
  switch (c.target.kind) {
    case "cabinet":
      return null;
    case "drawer":
      if (c.target.index >= ctx.drawerCount) {
        return unresolvedTarget(c, "drawer", c.target.index, ctx.drawerCount);
      }
      return null;
    case "door":
      if (c.target.index >= ctx.doorCount) {
        return unresolvedTarget(c, "door", c.target.index, ctx.doorCount);
      }
      return null;
    case "shelf":
      if (c.target.index >= ctx.shelfCount) {
        return unresolvedTarget(c, "shelf", c.target.index, ctx.shelfCount);
      }
      return null;
  }
}

function unresolvedTarget(
  c: CabinetInteriorComponent,
  kind: string,
  index: number,
  count: number,
): InteriorReadinessIssue {
  const humanIndex = index + 1; // UI convention: 1-based
  return {
    code: "INTERIOR_COMPONENT_TARGET_UNRESOLVED",
    severity: "warning",
    detail: `${humanTypeName(c.type)} targets ${kind} ${humanIndex}, but this cabinet has ${count} ${kind}${count === 1 ? "" : "s"}.`,
    componentIds: [c.id],
  };
}

function humanTypeName(t: InteriorComponentType): string {
  const map: Record<InteriorComponentType, string> = {
    rollout: "Rollout",
    trash_pullout: "Trash Pullout",
    tray_divider: "Tray Divider",
    spice_rack: "Spice Rack",
    knife_organizer: "Knife Organizer",
    utensil_divider: "Utensil Divider",
    drawer_divider: "Drawer Divider",
    hidden_drawer: "Hidden Drawer",
    sink_pullout: "Sink Pullout",
    sponge_tilt_out: "Sponge Tilt-Out",
    custom: "Custom Component",
  };
  return map[t];
}

function humanCabinetType(t: string): string {
  return t.replace(/_/g, " ");
}
