import type { WallDefinition } from "./types";
import { compileWall, type CompiledOpening, type WallSegment } from "./wall-compiler";
import { getWallFrame, type WallFrame } from "./wall-math";

// Wall elevation adapter — projects a compiled wall into a flat 2D drawing
// suitable for an elevation view (looking straight at the wall from inside
// the room). Coordinates are wall-LOCAL millimeters:
//
//   · X axis = along the wall from start to end (matches wallLocalX).
//   · Y axis = height above the floor (0 → wall.heightMm).
//
// Callers scale to their canvas / SVG viewport and can rely on this shape
// being stable across renderer swaps (SVG floor-plan, R3F elevation
// overlay, print export).

export interface WallElevationGeometry {
  wallId: string;
  frame: WallFrame;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  /** Solid rectangular segments in wall-local coords. */
  segments: readonly WallSegment[];
  /** Opening rectangles (holes) in wall-local coords — same as
   *  compileWall's `openings`. */
  openings: readonly CompiledOpening[];
}

/** Adapter used by both the 3D elevation overlay and the 2D floor-plan
 *  callouts. Pure — call as often as you like; caching is the caller's
 *  responsibility (see the memoized wrapper in the renderer). */
export function getWallElevationGeometry(wall: WallDefinition): WallElevationGeometry {
  const compiled = compileWall(wall);
  return {
    wallId: wall.id,
    frame: compiled.frame,
    widthMm: compiled.frame.lengthMm,
    heightMm: compiled.heightMm,
    thicknessMm: compiled.thicknessMm,
    segments: compiled.segments,
    openings: compiled.openings,
  };
}

/** Same, but starts from a wall picked out of a full architecture. */
export function getWallElevationGeometryById(
  walls: readonly WallDefinition[],
  wallId: string,
): WallElevationGeometry | null {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return null;
  return getWallElevationGeometry(wall);
}

/** Convenience — recompute the frame directly (skips segment compile). */
export function getWallElevationFrame(wall: WallDefinition): WallFrame {
  return getWallFrame(wall);
}
