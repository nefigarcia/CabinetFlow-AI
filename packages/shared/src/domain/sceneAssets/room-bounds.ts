import type { AABB, Vec3Mm } from "./aabb";

// Room-bounds validation. The current `Room` model treats its floor plane
// as an axis-aligned box anchored at the world origin:
//
//   x ∈ [0, room.widthMm]
//   y ∈ [0, room.heightMm]
//   z ∈ [0, room.depthMm]
//
// Anything outside these ranges is "outside" the room. A single asset can
// violate multiple sides at once (e.g. through a corner), so validation
// emits one code per direction.

export interface RoomBoundsMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export function getRoomBoundsAabb(room: RoomBoundsMm): AABB {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: room.widthMm, y: room.heightMm, z: room.depthMm },
  };
}

export function isInsideRoomBounds(aabb: AABB, room: RoomBoundsMm): boolean {
  return (
    aabb.min.x >= 0 &&
    aabb.min.y >= 0 &&
    aabb.min.z >= 0 &&
    aabb.max.x <= room.widthMm &&
    aabb.max.y <= room.heightMm &&
    aabb.max.z <= room.depthMm
  );
}

export type RoomBoundsViolation =
  | "OUTSIDE_LEFT"
  | "OUTSIDE_RIGHT"
  | "OUTSIDE_FRONT"
  | "OUTSIDE_BACK"
  | "BELOW_FLOOR"
  | "ABOVE_CEILING";

/**
 * Returns every direction in which the AABB pokes out of the room.
 * Returns [] when the asset is fully inside. Ordering is deterministic
 * (matches declaration order of `RoomBoundsViolation`).
 */
export function getRoomBoundsViolations(
  aabb: AABB,
  room: RoomBoundsMm,
): RoomBoundsViolation[] {
  const violations: RoomBoundsViolation[] = [];
  if (aabb.min.x < 0) violations.push("OUTSIDE_LEFT");
  if (aabb.max.x > room.widthMm) violations.push("OUTSIDE_RIGHT");
  if (aabb.min.z < 0) violations.push("OUTSIDE_BACK");
  if (aabb.max.z > room.depthMm) violations.push("OUTSIDE_FRONT");
  if (aabb.min.y < 0) violations.push("BELOW_FLOOR");
  if (aabb.max.y > room.heightMm) violations.push("ABOVE_CEILING");
  return violations;
}

/** Human-readable label for a violation. Used by the Inspector UI. */
export const ROOM_BOUNDS_VIOLATION_LABELS: Record<RoomBoundsViolation, string> = {
  OUTSIDE_LEFT: "Extends past the left wall",
  OUTSIDE_RIGHT: "Extends past the right wall",
  OUTSIDE_FRONT: "Extends past the front wall",
  OUTSIDE_BACK: "Extends past the back wall",
  BELOW_FLOOR: "Below floor level",
  ABOVE_CEILING: "Extends past the ceiling",
};

/** Returns how many millimeters the AABB overshoots the room on each side.
 *  Zero when inside. Positive values only. */
export function getRoomBoundsOverhang(
  aabb: AABB,
  room: RoomBoundsMm,
): {
  left: number;
  right: number;
  front: number;
  back: number;
  belowFloor: number;
  aboveCeiling: number;
} {
  return {
    left: Math.max(0, -aabb.min.x),
    right: Math.max(0, aabb.max.x - room.widthMm),
    back: Math.max(0, -aabb.min.z),
    front: Math.max(0, aabb.max.z - room.depthMm),
    belowFloor: Math.max(0, -aabb.min.y),
    aboveCeiling: Math.max(0, aabb.max.y - room.heightMm),
  };
}

/** Convenience: bottom-center of an AABB, useful for placement suggestions. */
export function aabbBottomCenter(a: AABB): Vec3Mm {
  return {
    x: (a.min.x + a.max.x) / 2,
    y: a.min.y,
    z: (a.min.z + a.max.z) / 2,
  };
}
