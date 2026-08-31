import type { Cabinet } from "../../types/cabinet";
import type { WallDefinition, WallOpening } from "../architecture/types";
import type { SceneAssetDefinition } from "../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../sceneAssets/scene-asset-instance";
import { getWallFrame, worldToWallLocal } from "../architecture/wall-math";
import {
  CABINET_WALL_PLACEMENT_KEY,
  getCabinetWallPlacement,
  isFloorMountedCabinetType,
  type CabinetWallPlacement,
} from "./wall-placement";

// Cabinet Run domain.
//
// A "run" is a DERIVED grouping of cabinets that share the same wall.
// Nothing is persisted — the run is reconstructed from the cabinets
// themselves on demand. This keeps the DB schema unchanged.
//
// The run's ordering is by wall-local offset (left → right along the
// wall's tangent). Ties break by cabinet id for determinism.

export interface CabinetRunItem {
  cabinetId: string;
  cabinet: Cabinet;
  placement: CabinetWallPlacement;
  /** Convenience: wall-local right edge = offsetMm + widthMm. */
  rightEdgeMm: number;
}

export interface CabinetRun {
  wallId: string;
  wall: WallDefinition;
  /** Cabinets sorted by placement.offsetMm ascending. */
  items: CabinetRunItem[];
}

/** Buckets cabinets by their attached wall and returns a run per wall.
 *  Free (unattached) cabinets are dropped — the caller can enumerate
 *  them separately. */
export function buildCabinetRuns(input: {
  cabinets: Cabinet[];
  walls: WallDefinition[];
}): CabinetRun[] {
  const wallById = new Map<string, WallDefinition>();
  for (const w of input.walls) wallById.set(w.id, w);

  const bucket = new Map<string, CabinetRunItem[]>();
  for (const cab of input.cabinets) {
    const placement = getCabinetWallPlacement(cab);
    if (!placement) continue;
    const wall = wallById.get(placement.wallId);
    if (!wall) continue;
    const arr = bucket.get(placement.wallId) ?? [];
    arr.push({
      cabinetId: cab.id,
      cabinet: cab,
      placement,
      rightEdgeMm: placement.offsetMm + Number(cab.width),
    });
    bucket.set(placement.wallId, arr);
  }

  const runs: CabinetRun[] = [];
  for (const [wallId, items] of bucket) {
    runs.push({
      wallId,
      wall: wallById.get(wallId)!,
      items: sortRunItems(items),
    });
  }
  // Deterministic ordering across runs — by wall id, so consumers can
  // iterate without surprise.
  runs.sort((a, b) => a.wallId.localeCompare(b.wallId));
  return runs;
}

/** Returns cabinets that are NOT attached to any wall (legacy / free). */
export function getFreeCabinets(cabinets: Cabinet[]): Cabinet[] {
  return cabinets.filter((c) => !c.parameters?.[CABINET_WALL_PLACEMENT_KEY]);
}

/** Deterministic left-to-right sort along the wall. */
export function sortRunItems(items: CabinetRunItem[]): CabinetRunItem[] {
  return items.slice().sort((a, b) => {
    if (a.placement.offsetMm !== b.placement.offsetMm) {
      return a.placement.offsetMm - b.placement.offsetMm;
    }
    return a.cabinetId.localeCompare(b.cabinetId);
  });
}

/** Wall-local extent of the run: {startMm, endMm, totalWidthMm}. Empty
 *  run returns null. `totalWidthMm` is the union of cabinet widths
 *  (INCLUDES any interior gaps — it's endMm - startMm). Use
 *  `getRunCabinetsWidthSum` for the sum of cabinet widths alone. */
export function getCabinetRunExtent(
  run: CabinetRun,
): { startMm: number; endMm: number; totalWidthMm: number } | null {
  if (run.items.length === 0) return null;
  const first = run.items[0]!;
  const last = run.items[run.items.length - 1]!;
  return {
    startMm: first.placement.offsetMm,
    endMm: last.rightEdgeMm,
    totalWidthMm: last.rightEdgeMm - first.placement.offsetMm,
  };
}

/** Sum of cabinet widths (no gaps). */
export function getRunCabinetsWidthSum(run: CabinetRun): number {
  let sum = 0;
  for (const it of run.items) sum += Number(it.cabinet.width);
  return sum;
}

// ─── Gap + overlap detection ────────────────────────────────────────────

export type RunGapKind =
  | "exact" // widthMm ≈ 0 within tolerance
  | "filler" // small (< FILLER_MAX_MM), suitable for a filler strip
  | "intentional" // covered by an appliance / opening / scene asset (see reason)
  | "unassigned"; // widthMm > FILLER_MAX_MM and not intentional — a warning

export const FILLER_MAX_MM = 100;
export const EXACT_TOL_MM = 0.5;

export interface RunGap {
  kind: RunGapKind;
  startMm: number;
  endMm: number;
  widthMm: number;
  /** Populated when kind === "intentional". */
  reason?: {
    kind: "opening" | "scene-asset";
    id: string;
    label?: string;
  };
}

export interface RunOverlap {
  aCabinetId: string;
  bCabinetId: string;
  /** Overlap width in mm (positive means overlap). */
  widthMm: number;
}

/**
 * Detects gaps between adjacent cabinets in a run. Optional context:
 *   · openings on the wall (doors/windows/generic) — a gap that fully
 *     contains an opening becomes `kind = "intentional"` with reason
 *     `opening`.
 *   · appliance scene assets attached to the same wall — a gap fully
 *     covering an appliance becomes `kind = "intentional"` with reason
 *     `scene-asset`.
 * Gaps ≤ EXACT_TOL_MM = "exact"; ≤ FILLER_MAX_MM = "filler"; otherwise
 * "unassigned" unless an intentional reason applies.
 */
export function detectRunGaps(input: {
  run: CabinetRun;
  openings?: readonly WallOpening[];
  applianceExtents?: readonly {
    id: string;
    startMm: number;
    endMm: number;
    label?: string;
  }[];
}): RunGap[] {
  const gaps: RunGap[] = [];
  const items = input.run.items;
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]!;
    const b = items[i + 1]!;
    const startMm = a.rightEdgeMm;
    const endMm = b.placement.offsetMm;
    const widthMm = endMm - startMm;
    if (widthMm <= EXACT_TOL_MM) {
      gaps.push({ kind: "exact", startMm, endMm, widthMm: Math.max(0, widthMm) });
      continue;
    }
    const reason = findIntentionalReason(startMm, endMm, input.openings, input.applianceExtents);
    if (reason) {
      gaps.push({ kind: "intentional", startMm, endMm, widthMm, reason });
      continue;
    }
    if (widthMm <= FILLER_MAX_MM) {
      gaps.push({ kind: "filler", startMm, endMm, widthMm });
    } else {
      gaps.push({ kind: "unassigned", startMm, endMm, widthMm });
    }
  }
  return gaps;
}

function findIntentionalReason(
  gapStart: number,
  gapEnd: number,
  openings?: readonly WallOpening[],
  appliances?: readonly { id: string; startMm: number; endMm: number; label?: string }[],
): RunGap["reason"] | undefined {
  const covers = (aStart: number, aEnd: number): boolean =>
    aStart >= gapStart - EXACT_TOL_MM && aEnd <= gapEnd + EXACT_TOL_MM;
  if (openings) {
    for (const op of openings) {
      const aStart = op.offsetMm;
      const aEnd = op.offsetMm + op.widthMm;
      // The gap is intentional if it CONTAINS the opening OR the opening
      // fully contains the gap. Either shape reads as "this space is for
      // the door / window."
      if (covers(aStart, aEnd) || (aStart <= gapStart && aEnd >= gapEnd)) {
        return { kind: "opening", id: op.id, label: op.label };
      }
    }
  }
  if (appliances) {
    for (const ap of appliances) {
      if (covers(ap.startMm, ap.endMm) || (ap.startMm <= gapStart && ap.endMm >= gapEnd)) {
        return { kind: "scene-asset", id: ap.id, label: ap.label };
      }
    }
  }
  return undefined;
}

/** Detects overlapping cabinets within a run. Pairs are unique
 *  (a.id < b.id) and returned in run order. */
export function detectRunOverlaps(run: CabinetRun): RunOverlap[] {
  const out: RunOverlap[] = [];
  const items = run.items;
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]!;
    const b = items[i + 1]!;
    const overlap = a.rightEdgeMm - b.placement.offsetMm;
    if (overlap > EXACT_TOL_MM) {
      out.push({ aCabinetId: a.cabinetId, bCabinetId: b.cabinetId, widthMm: overlap });
    }
  }
  return out;
}

// ─── Remaining wall space ───────────────────────────────────────────────

export interface RemainingSpaceInput {
  wall: WallDefinition;
  run?: CabinetRun | null;
  /** Openings that reduce usable wall span for FLOOR-mounted cabinets.
   *  Wall cabinets have their own logic (call getRemainingWallSpace
   *  twice — once floor, once wall — with the appropriate subset). */
  openings?: readonly WallOpening[];
  /** Appliance/scene-asset extents that reduce usable wall span. */
  applianceExtents?: readonly { startMm: number; endMm: number }[];
}

export interface RemainingSpace {
  wallLengthMm: number;
  cabinetsWidthMm: number;
  openingsWidthMm: number;
  appliancesWidthMm: number;
  intentionalGapsWidthMm: number;
  remainingMm: number;
}

/**
 * Pure formula:
 *   remaining = wallLength - cabinets - openings - appliances - intentional gaps
 * where intentional gaps are gaps in the run that resolve to an opening
 * or an appliance (so they aren't double-counted).
 * The result may be NEGATIVE — that indicates the layout overshoots the
 * wall and is a validation problem for the caller.
 */
export function getRemainingWallSpace(input: RemainingSpaceInput): RemainingSpace {
  const wallLengthMm =
    Math.hypot(
      input.wall.endMm.x - input.wall.startMm.x,
      input.wall.endMm.z - input.wall.startMm.z,
    ) || 0;
  const cabinetsWidthMm = input.run ? getRunCabinetsWidthSum(input.run) : 0;
  const openingsWidthMm = (input.openings ?? []).reduce((s, o) => s + o.widthMm, 0);
  const appliancesWidthMm = (input.applianceExtents ?? []).reduce(
    (s, a) => s + Math.max(0, a.endMm - a.startMm),
    0,
  );
  const intentionalGapsWidthMm = input.run
    ? detectRunGaps({
        run: input.run,
        openings: input.openings,
        applianceExtents: (input.applianceExtents ?? []).map((a, i) => ({
          id: `ap:${i}`,
          startMm: a.startMm,
          endMm: a.endMm,
        })),
      })
        .filter((g) => g.kind === "intentional")
        .reduce((s, g) => s + g.widthMm, 0)
    : 0;
  const remainingMm =
    wallLengthMm -
    cabinetsWidthMm -
    openingsWidthMm -
    appliancesWidthMm -
    // Intentional gaps were already subtracted implicitly via openings/
    // appliances — do not double-count them.
    0;
  return {
    wallLengthMm,
    cabinetsWidthMm,
    openingsWidthMm,
    appliancesWidthMm,
    intentionalGapsWidthMm,
    remainingMm,
  };
}

// ─── Scene-asset appliance extents ──────────────────────────────────────

/** Given wall-attached appliance scene assets, project each onto the
 *  wall's local X axis and return the [startMm, endMm] extent. Skips
 *  assets attached to a DIFFERENT wall. */
export function getApplianceExtentsOnWall(input: {
  wall: WallDefinition;
  sceneAssets: readonly {
    instance: SceneAssetInstance;
    definition: SceneAssetDefinition;
  }[];
}): { id: string; startMm: number; endMm: number; label?: string }[] {
  const out: { id: string; startMm: number; endMm: number; label?: string }[] = [];
  const frame = getWallFrame(input.wall);
  for (const { instance, definition } of input.sceneAssets) {
    const attach = instance.placement?.mode === "wall" ? instance.placement.wall : undefined;
    if (!attach || attach.wallId !== input.wall.id) continue;
    // Appliance width along wall = definition width (cabinets face into
    // room; the appliance's local X is the wall's X).
    const centerX = attach.localPositionMm.x;
    const halfW = (definition.dimensionsMm?.widthMm ?? 0) / 2;
    out.push({
      id: instance.id,
      startMm: centerX - halfW,
      endMm: centerX + halfW,
      label: definition.name,
    });
    // Reference `frame` so this function stays wall-scoped even when
    // callers pass wall placements that predate future architecture
    // edits — a fallback to worldToWallLocal is available if needed.
    void frame;
  }
  return out;
}

/** Fallback for computing an appliance's wall-local extent when only its
 *  WORLD position is known (free scene asset near a wall). Projects the
 *  asset's world center onto the wall tangent. */
export function projectWorldCenterOntoWall(
  wall: WallDefinition,
  worldCenterMm: { x: number; z: number },
  widthMm: number,
): { startMm: number; endMm: number } {
  const frame = getWallFrame(wall);
  const local = worldToWallLocal(frame, { x: worldCenterMm.x, y: 0, z: worldCenterMm.z });
  return {
    startMm: local.xMm - widthMm / 2,
    endMm: local.xMm + widthMm / 2,
  };
}

// ─── Convenience floor / wall filter ────────────────────────────────────

/** Filters a run to items whose type is floor-mounted. Useful when
 *  computing remaining floor space vs. remaining upper-wall space. */
export function filterFloorMountedRun(run: CabinetRun): CabinetRun {
  return {
    ...run,
    items: run.items.filter((it) => isFloorMountedCabinetType(it.cabinet.type)),
  };
}
