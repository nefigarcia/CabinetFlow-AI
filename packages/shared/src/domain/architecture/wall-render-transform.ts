import type { WallDefinition } from "./types";
import { getWallFrame } from "./wall-math";

// Render-side transform math for wall meshes.
//
// SEMANTIC CONTRACT — this file is the single source of truth:
//
//   The architecture DESIGN LINE (a wall's start→end segment on the
//   floor plan) IS the INTERIOR wall face. Cabinets and wall-attached
//   scene assets place their back at wall-local Z = 0 and expect that
//   Z = 0 to sit on the interior face of the wall. See
//   `computeCabinetWorldPosition` and `resolveWallAttachedSceneAssetTransform`.
//
//   Therefore the wall MESH must extend OUTWARD ONLY from the design
//   line — never straddle it. Concretely, for a south wall (start (0,0),
//   end (W,0), thickness T, inward normal +Z):
//
//        interior face  ─── design line at world Z = 0
//        exterior face  ─── world Z = -T
//        wall body      ─── world Z spans -T ..  0
//
//   And the FLOOR polygon (from extractFloorPolygon) naturally sits on
//   the interior faces because it walks the wall start points.

/**
 * Returns the render-group transform for a wall so that:
 *   · The group's world position sits at the wall's OUTER-corner start
 *     (design line + outward normal * full thickness).
 *   · Its Y rotation aligns the group's local +X axis with the wall's
 *     tangent (start → end direction).
 *   · Inside the group, a segment mesh authored with local Z spanning
 *     0 .. thickness (drei/three's `boxGeometry` centered at local
 *     Z = thickness/2) then lands at world Z spanning -T .. 0, i.e.
 *     the mesh extends OUTWARD from the design line.
 *
 * The `rotationY` value is meant to be applied as `<group rotation=[0, rotationY, 0]>`
 * — following the existing three.js convention of negated-angleRad used
 * elsewhere in the renderer (see `SceneAssetItem` wall-attached wrapper).
 */
export interface WallRenderTransform {
  /** World position (mm) where the render group's origin sits. */
  originMm: { x: number; z: number };
  /** Y-axis rotation in radians (three.js convention). */
  rotationY: number;
  /** Wall length along the tangent (mm). */
  lengthMm: number;
  /** Wall thickness (mm), passed through for convenience. */
  thicknessMm: number;
}

export function getWallRenderTransform(wall: WallDefinition): WallRenderTransform {
  const frame = getWallFrame(wall);
  // Outward normal = -inward normal. Push the origin outward by the FULL
  // wall thickness so that a mesh authored in the group's local frame at
  // local Z = 0 .. thickness lands OUTSIDE the design line.
  const outwardX = -frame.normal.x;
  const outwardZ = -frame.normal.z;
  const originX = wall.startMm.x + outwardX * wall.thicknessMm;
  const originZ = wall.startMm.z + outwardZ * wall.thicknessMm;
  return {
    originMm: { x: originX, z: originZ },
    rotationY: -frame.angleRad,
    lengthMm: frame.lengthMm,
    thicknessMm: wall.thicknessMm,
  };
}

/**
 * Returns the interior-face world position at a given wall-local
 * (offsetMm, elevationMm) point. Equivalent to `wallLocalToWorld` with
 * zMm = 0 but named to make the render/geometry-check intent explicit.
 *
 * Under the render contract, THIS is the coordinate a wall-attached
 * cabinet's back or scene asset's back edge should land on in world
 * space.
 */
export function getInteriorFaceWorldPointMm(
  wall: WallDefinition,
  offsetMm: number,
  elevationMm: number,
): { x: number; y: number; z: number } {
  const frame = getWallFrame(wall);
  return {
    x: wall.startMm.x + offsetMm * frame.tangent.x,
    y: elevationMm,
    z: wall.startMm.z + offsetMm * frame.tangent.z,
  };
}

/**
 * Returns the exterior-face world position — one full wall thickness
 * OUTWARD from the interior face. Useful for tests + debug overlays.
 */
export function getExteriorFaceWorldPointMm(
  wall: WallDefinition,
  offsetMm: number,
  elevationMm: number,
): { x: number; y: number; z: number } {
  const frame = getWallFrame(wall);
  return {
    x: wall.startMm.x + offsetMm * frame.tangent.x + -frame.normal.x * wall.thicknessMm,
    y: elevationMm,
    z: wall.startMm.z + offsetMm * frame.tangent.z + -frame.normal.z * wall.thicknessMm,
  };
}
