import type { WallDefinition } from "../architecture/types";
import type { WorldPointMm } from "../architecture/wall-math";
import { getWallFrame, worldToWallLocal } from "../architecture/wall-math";

// Pure math for dragging a cabinet along a wall — the domain half of
// the drag interaction. The UI half lives in a React hook that hands
// world-space pointer positions here and receives back a candidate
// wall-local offset (mm) ready to feed into `CabinetWallPlacement`.
//
// Contract: the offset returned is the cabinet's LEFT edge in
// wall-local X — the same value stored on `parameters.wallPlacement`.
// That way the world-position computation the renderer already uses
// (`computeCabinetWorldPosition`) needs no changes to pick up the drag
// result.
//
// Every helper here is a pure function. No THREE, no React, no
// interaction state — all of which live in the drag hook.

/**
 * Projects a world-space point onto a wall's tangent axis and returns the
 * offset (in wall-local mm) that would place a cabinet's LEFT edge under
 * that point. Callers usually feed this the pointer's world XZ during a
 * drag — the Y component is ignored because dragging is 2D on the floor
 * plane.
 *
 * `cabinetWidthMm` shifts the offset so the pointer tracks the cabinet's
 * CENTER rather than its left edge — matches the user's mental model of
 * "the cursor holds the middle of the thing being dragged". Pass `0` to
 * keep the offset at the left edge (useful for snapping calculations).
 */
export function projectWorldPointToCabinetWallOffset(input: {
  worldPoint: Pick<WorldPointMm, "x" | "z">;
  wall: Pick<WallDefinition, "startMm" | "endMm">;
  cabinetWidthMm: number;
}): number {
  const frame = getWallFrame(input.wall);
  const local = worldToWallLocal(frame, {
    x: input.worldPoint.x,
    y: 0,
    z: input.worldPoint.z,
  });
  // Pointer holds the center → subtract half-width to get left-edge offset.
  return local.xMm - input.cabinetWidthMm / 2;
}

/**
 * Width-aware clamp: keeps the cabinet body entirely between the wall
 * endpoints. Returns the safe offset (never `< 0`, never `> wallLength -
 * cabinetWidth`).
 *
 * Guards a nonsense config (`cabinetWidth > wallLength`) by returning 0
 * — the caller's higher-level layout validator can flag this as invalid.
 */
export function clampCabinetOffset(input: {
  offsetMm: number;
  cabinetWidthMm: number;
  wallLengthMm: number;
}): number {
  const { offsetMm, cabinetWidthMm, wallLengthMm } = input;
  const maxOffset = wallLengthMm - cabinetWidthMm;
  if (maxOffset < 0) return 0;
  if (!Number.isFinite(offsetMm)) return 0;
  return Math.max(0, Math.min(maxOffset, offsetMm));
}

/** A candidate snap target expressed in wall-local mm. `edge` is the
 *  side of the cabinet that should snap to `offsetMm` — LEFT snaps the
 *  cabinet's left edge to `offsetMm`, RIGHT snaps its right edge there. */
export interface SnapTarget {
  offsetMm: number;
  edge: "left" | "right";
  /** Optional label for diagnostics — "wall-start", "cabinet-3-right", etc. */
  reason?: string;
}

/** Result of a snap attempt. If `snapped` is false, `offsetMm` is the
 *  input value unchanged. */
export interface SnapResult {
  offsetMm: number;
  snapped: boolean;
  snappedTo?: SnapTarget;
}

/**
 * Snaps a candidate LEFT-edge offset to the nearest snap target within
 * `toleranceMm`. Snap targets can be expressed for either edge (a snap
 * of the cabinet's RIGHT edge to a target at 3500 mm on a 600-wide
 * cabinet means the LEFT edge lands at 2900 mm). Returns the input
 * unchanged when no target is close enough.
 */
export function snapCabinetOffset(input: {
  offsetMm: number;
  cabinetWidthMm: number;
  targets: readonly SnapTarget[];
  toleranceMm: number;
}): SnapResult {
  const { offsetMm, cabinetWidthMm, targets, toleranceMm } = input;
  let best: { target: SnapTarget; candidateOffset: number; delta: number } | null =
    null;
  for (const t of targets) {
    const candidateOffset =
      t.edge === "left" ? t.offsetMm : t.offsetMm - cabinetWidthMm;
    const delta = Math.abs(candidateOffset - offsetMm);
    if (delta <= toleranceMm && (!best || delta < best.delta)) {
      best = { target: t, candidateOffset, delta };
    }
  }
  if (!best) return { offsetMm, snapped: false };
  return {
    offsetMm: best.candidateOffset,
    snapped: true,
    snappedTo: best.target,
  };
}

/** Default snap tolerance in millimeters — matches the on-screen "1 cm"
 *  ballpark that other drag flows use. Centralized so all callers pick
 *  up a change atomically. */
export const DEFAULT_SNAP_TOLERANCE_MM = 10;
