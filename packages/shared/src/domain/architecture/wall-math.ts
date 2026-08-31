import type { Vec2Mm, WallDefinition } from "./types";

// Wall-local coordinate math.
//
// Every wall defines a local frame:
//   · local X = along the wall, from start toward end
//   · local Y = world +Y (walls are vertical in MVP)
//   · local Z = wall normal, pointing INTO the room for counter-
//     clockwise-wound wall lists (right-hand rule: Y × X → inward)
//
// Openings and wall-mounted objects live in these local coordinates so
// they stay attached to the wall through wall edits. All world-space
// helpers assume the room's +X = right and +Z = into the room.

export interface WallFrame {
  /** Wall start in world XZ (mm). */
  startMm: Vec2Mm;
  /** Wall end in world XZ (mm). */
  endMm: Vec2Mm;
  /** Total wall length along the local X axis (mm). */
  lengthMm: number;
  /** Wall angle in RADIANS. Rotation around world Y. Zero when the wall
   *  runs east-west with start on the west and end on the east. */
  angleRad: number;
  /** Wall-local X axis in world coordinates (unit vector, XZ plane). */
  tangent: Vec2Mm;
  /** Wall inward normal in world coordinates (unit vector, XZ plane). */
  normal: Vec2Mm;
}

/** Number of digits to check on angle math for testing. */
export const ANGLE_EPSILON = 1e-9;

/**
 * Computes the wall's local frame from its start/end. Handles zero-length
 * walls defensively — returns tangent (1, 0) and normal (0, 1) so callers
 * downstream don't NaN. Consumers should validate wall length separately.
 */
export function getWallFrame(wall: Pick<WallDefinition, "startMm" | "endMm">): WallFrame {
  const dx = wall.endMm.x - wall.startMm.x;
  const dz = wall.endMm.z - wall.startMm.z;
  const lengthMm = Math.hypot(dx, dz);

  if (lengthMm === 0) {
    return {
      startMm: { ...wall.startMm },
      endMm: { ...wall.endMm },
      lengthMm: 0,
      angleRad: 0,
      tangent: { x: 1, z: 0 },
      normal: { x: 0, z: 1 },
    };
  }

  const tx = dx / lengthMm;
  const tz = dz / lengthMm;

  // Inward normal for the legacy CCW-wound (visually CW-viewed-from-above)
  // wall list: right-hand normal from wall tangent. For a south wall
  // (0,0)→(W,0), tangent = (1,0), inward normal = (0,+1) points into the
  // room at +Z. For a west wall (0,D)→(0,0), tangent = (0,-1), inward
  // normal = (+1,0) points into the room at +X. Formula: (-tz, tx).
  const nx = -tz;
  const nz = tx;

  return {
    startMm: { ...wall.startMm },
    endMm: { ...wall.endMm },
    lengthMm,
    // atan2(z, x) gives the angle in the XZ plane measured from +X toward +Z.
    angleRad: Math.atan2(dz, dx),
    tangent: { x: tx, z: tz },
    normal: { x: nx, z: nz },
  };
}

/** Wall-local point: X along wall (mm), Y vertical (mm), Z normal (mm). */
export interface WallLocalPoint {
  xMm: number;
  yMm: number;
  zMm: number;
}

/** World-space point (X, Y, Z) in millimeters. */
export interface WorldPointMm {
  x: number;
  y: number;
  z: number;
}

/** Wall-local → world. Y is preserved; X moves along tangent, Z along
 *  inward normal. Both offsets are measured from the wall's `startMm`. */
export function wallLocalToWorld(
  frame: WallFrame,
  local: WallLocalPoint,
): WorldPointMm {
  return {
    x:
      frame.startMm.x +
      local.xMm * frame.tangent.x +
      local.zMm * frame.normal.x,
    y: local.yMm,
    z:
      frame.startMm.z +
      local.xMm * frame.tangent.z +
      local.zMm * frame.normal.z,
  };
}

/** World → wall-local. Projects onto the wall's tangent + normal axes.
 *  Points off the plane (Y != wall's Y) preserve their Y in localY. */
export function worldToWallLocal(
  frame: WallFrame,
  world: WorldPointMm,
): WallLocalPoint {
  const dx = world.x - frame.startMm.x;
  const dz = world.z - frame.startMm.z;
  return {
    xMm: dx * frame.tangent.x + dz * frame.tangent.z,
    yMm: world.y,
    zMm: dx * frame.normal.x + dz * frame.normal.z,
  };
}

/** Convenience: wall length (mm). Never negative. */
export function getWallLengthMm(wall: Pick<WallDefinition, "startMm" | "endMm">): number {
  return getWallFrame(wall).lengthMm;
}
