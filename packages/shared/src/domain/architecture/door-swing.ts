import type { DoorOpening, WallDefinition } from "./types";
import { getWallFrame, wallLocalToWorld, type WallFrame } from "./wall-math";

// Door-swing geometry — editor-only visualization for the 2D floor plan
// and the 3D overlay. Produces a leaf line (the swinging edge of the
// door) and an arc (the path traced by the leaf's free corner) both in
// WORLD XZ coordinates (millimeters).
//
// Interpretation:
//   · hinge sits at the wall inner face — wall-local Z = 0.
//   · leaf spans `widthMm` from the hinge along the wall tangent; direction
//     depends on `hingeSide` ("left" pivots at the door's LEFT edge —
//     leaf extends toward the RIGHT).
//   · swing direction ("inward"/"outward") flips the arc across the wall
//     line. Inward → arc extends into the room (wall inward normal side).
//
// When `hingeSide` / `swingDirection` are omitted, we default to
// hingeSide="left", swingDirection="inward" — matches the ordinary
// residential convention and never crashes the renderer.

export interface DoorSwingGeometry {
  /** Hinge position in world XZ (mm). */
  hingeMm: { x: number; z: number };
  /** Free corner of the leaf (perpendicular to the wall, 90° swept)
   *  in world XZ (mm). */
  leafEndMm: { x: number; z: number };
  /** Points sampled along the arc from `hingeMm + leaf-along-wall`
   *  to `leafEndMm`. `SAMPLE_COUNT + 1` points including both endpoints. */
  arcPointsMm: Array<{ x: number; z: number }>;
  /** Door leaf width used to size the geometry. */
  widthMm: number;
}

const ARC_SAMPLE_COUNT = 12;

export function getDoorSwingGeometry(
  wall: Pick<WallDefinition, "startMm" | "endMm">,
  door: Pick<DoorOpening, "offsetMm" | "widthMm" | "hingeSide" | "swingDirection">,
): DoorSwingGeometry {
  const frame = getWallFrame(wall);
  const hingeSide = door.hingeSide ?? "left";
  const swing = door.swingDirection ?? "inward";

  // Hinge in wall-local coords. "left" = at the opening's left edge
  // (= offsetMm); "right" = at the opening's right edge (= offsetMm + widthMm).
  const hingeXLocal = hingeSide === "left" ? door.offsetMm : door.offsetMm + door.widthMm;
  // Direction the leaf lies when CLOSED (along the wall, into the opening).
  const leafDir = hingeSide === "left" ? 1 : -1;

  // Sign along the wall's inward normal for the open-90° pose. Inward
  // swing → positive normal; outward → negative.
  const normalSign = swing === "inward" ? 1 : -1;

  const hingeWorld = wallLocalToWorld(frame, { xMm: hingeXLocal, yMm: 0, zMm: 0 });
  // 90°-open leaf endpoint = hinge + widthMm along inward normal (or
  // outward, per swing).
  const leafEndLocal = { xMm: hingeXLocal, yMm: 0, zMm: normalSign * door.widthMm };
  const leafEndWorld = wallLocalToWorld(frame, leafEndLocal);

  return {
    hingeMm: { x: hingeWorld.x, z: hingeWorld.z },
    leafEndMm: { x: leafEndWorld.x, z: leafEndWorld.z },
    arcPointsMm: buildArc(frame, hingeXLocal, leafDir, normalSign, door.widthMm),
    widthMm: door.widthMm,
  };
}

function buildArc(
  frame: WallFrame,
  hingeXLocal: number,
  leafDir: number,
  normalSign: number,
  widthMm: number,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  // theta = 0 → closed (leaf lies along the wall in `leafDir`).
  // theta = π/2 → 90° open (leaf perpendicular to wall in swing direction).
  const start = 0;
  const end = Math.PI / 2;
  for (let i = 0; i <= ARC_SAMPLE_COUNT; i++) {
    const t = start + (end - start) * (i / ARC_SAMPLE_COUNT);
    const localX = hingeXLocal + Math.cos(t) * widthMm * leafDir;
    const localZ = Math.sin(t) * widthMm * normalSign;
    const world = wallLocalToWorld(frame, { xMm: localX, yMm: 0, zMm: localZ });
    out.push({ x: world.x, z: world.z });
  }
  return out;
}
