import { z } from "zod";

// Vec3 shape defined inline (not imported from scene-asset-instance.ts)
// to avoid a circular import — scene-asset-instance.ts imports the
// placement schema from this file.
interface Vec3 {
  x: number;
  y: number;
  z: number;
}
const vec3Schema: z.ZodType<Vec3> = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Instance-level placement mode. This is DISTINCT from
// `SceneAssetPlacement` (in scene-asset-placement.ts), which describes
// what surfaces a DEFINITION can attach to. This one records how a
// specific INSTANCE is currently attached in the room.
//
// Two authoritative modes:
//   · "free"  — world position/rotation on the instance are authoritative.
//   · "wall"  — wallId + wall-local position are authoritative; the
//               instance's world transform is DERIVED from the wall's
//               frame at render time.
//
// Mode is EXPLICIT — never inferred from `wall != null`. That keeps the
// serializer round-trippable and prevents accidental attach/detach when
// UI code forgets to null out one side or the other.

export type SceneAssetPlacementMode = "free" | "wall";

/** Wall-local anchor. xMm = along wall from start; yMm = height above
 *  floor; zMm = surface offset (0 means asset back flush with the wall
 *  inner face — the resolver adds asset halfDepth internally). */
export interface WallAttachment {
  wallId: string;
  localPositionMm: Vec3;
}

export interface SceneAssetInstancePlacement {
  mode: SceneAssetPlacementMode;
  wall?: WallAttachment;
}

const wallAttachmentSchema: z.ZodType<WallAttachment> = z.object({
  wallId: z.string().min(1),
  localPositionMm: vec3Schema,
});

export const sceneAssetInstancePlacementSchema: z.ZodType<SceneAssetInstancePlacement> = z.object({
  mode: z.enum(["free", "wall"]),
  wall: wallAttachmentSchema.optional(),
});

export const DEFAULT_INSTANCE_PLACEMENT: SceneAssetInstancePlacement = { mode: "free" };

/** True when the instance currently has a wall attachment. Guards against
 *  the (invalid) shape `mode="wall"` with `wall` missing. */
export function isWallAttached(
  placement: SceneAssetInstancePlacement | undefined,
): placement is SceneAssetInstancePlacement & { wall: WallAttachment } {
  return placement?.mode === "wall" && placement.wall != null;
}

/** Resolves an instance's placement to a normalized value. Missing or
 *  malformed placement falls back to `{ mode: "free" }` so legacy rows and
 *  partial patches stay renderable. */
export function normalizeInstancePlacement(
  placement: SceneAssetInstancePlacement | undefined,
): SceneAssetInstancePlacement {
  if (!placement) return DEFAULT_INSTANCE_PLACEMENT;
  if (placement.mode === "wall" && placement.wall) {
    return { mode: "wall", wall: placement.wall };
  }
  return DEFAULT_INSTANCE_PLACEMENT;
}
