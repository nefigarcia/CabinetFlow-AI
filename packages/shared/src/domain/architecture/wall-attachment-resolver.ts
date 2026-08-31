import type { SceneAssetDefinition } from "../sceneAssets/scene-asset-definition";
import type { WallAttachment } from "../sceneAssets/instance-placement";
import type { RoomArchitecture, WallDefinition } from "./types";
import { getWallFrame, wallLocalToWorld } from "./wall-math";

// Pure resolver — no I/O, no store access. Given a wall-attached
// placement, produces the world transform (position + rotationY in
// degrees) that the renderer applies to the asset.
//
// Coordinate convention:
//   · Wall-local X (xMm) — offset along the wall from its start point.
//   · Wall-local Y (yMm) — height above the floor.
//   · Wall-local Z (zMm) — surface offset from the wall INNER face.
//     A value of 0 means the BACK FACE of the asset sits flush with the
//     wall inner face. The resolver adds `definition.dimensionsMm.depthMm / 2`
//     internally so the asset's CENTER is offset outward by half its depth.
//
// Facing:
//   · Wall inward normal points INTO the room. The asset's front (its
//     -Z face in its own local frame) should face into the room, so the
//     asset must rotate to align its local -Z with the wall normal.
//   · Three.js Y-rotation of θ maps local -Z = (0,0,-1) to world
//     (-sinθ, 0, -cosθ). Solving for that equal to normal (-tz, tx)
//     gives θ = π - angleRad. Encoded as `FACING_OFFSET_DEG - angle`.
//     Verified for all 4 legacy walls (south/east/north/west).
//
// Missing / invalid wall id returns `null`. Zero-length walls fall back
// to a defensive frame (see getWallFrame) but still resolve.

const FACING_OFFSET_DEG = 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface ResolvedWallAttachedTransform {
  positionMm: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
  /** Reference to the wall used to resolve. Handy for renderer overlays. */
  wall: WallDefinition;
}

export interface ResolveWallAttachedInput {
  attachment: WallAttachment;
  definition: Pick<SceneAssetDefinition, "dimensionsMm">;
  architecture: RoomArchitecture;
}

/** Looks the wall up in the architecture and resolves its world transform. */
export function resolveWallAttachedSceneAssetTransform(
  input: ResolveWallAttachedInput,
): ResolvedWallAttachedTransform | null {
  const wall = input.architecture.walls.find((w) => w.id === input.attachment.wallId);
  if (!wall) return null;
  return resolveWithWall({ attachment: input.attachment, definition: input.definition, wall });
}

interface ResolveWithWallInput {
  attachment: WallAttachment;
  definition: Pick<SceneAssetDefinition, "dimensionsMm">;
  wall: WallDefinition;
}

/** Same as `resolveWallAttachedSceneAssetTransform` but with the wall
 *  already resolved by the caller. Exposed for renderers that already
 *  loop over compiled walls. */
export function resolveWithWall(input: ResolveWithWallInput): ResolvedWallAttachedTransform {
  const frame = getWallFrame(input.wall);
  const halfDepthMm = (input.definition.dimensionsMm?.depthMm ?? 0) / 2;

  const local = input.attachment.localPositionMm;
  const world = wallLocalToWorld(frame, {
    xMm: local.x,
    yMm: local.y,
    zMm: local.z + halfDepthMm,
  });

  const rotationYDeg = FACING_OFFSET_DEG - frame.angleRad * RAD_TO_DEG;

  return {
    positionMm: { x: world.x, y: world.y, z: world.z },
    rotationDeg: { x: 0, y: rotationYDeg, z: 0 },
    wall: input.wall,
  };
}
