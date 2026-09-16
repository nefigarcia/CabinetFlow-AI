import { z } from "zod";
import {
  DEFAULT_INSTANCE_PLACEMENT,
  sceneAssetInstancePlacementSchema,
  type SceneAssetInstancePlacement,
} from "./instance-placement";

// Per-room placement of a Scene Asset. Positions in millimeters, rotations
// in degrees, scale as dimensionless multipliers.
//
// Kept SERIALIZABLE — never store THREE.Object3D / THREE.Material /
// THREE.Texture / GLTF scenes on an instance. The renderer resolves those
// live from the asset loader.
//
// Multi-tenant scoping: `orgId` and `roomId` are authoritative from the
// server. Clients must never send an orgId they choose themselves; the API
// derives it from the authenticated context. Project is intentionally not
// persisted here — it's derived via `room.project`, matching the existing
// `Cabinet` model's ownership pattern.

export const SCENE_ASSET_INSTANCE_SCHEMA_VERSION = "1.0" as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3Schema: z.ZodType<Vec3> = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export interface SceneAssetInstance {
  id: string;

  orgId: string;
  roomId: string;

  assetDefinitionId: string;

  positionMm: Vec3;
  rotationDeg: Vec3;
  scale: Vec3;

  visible: boolean;

  /**
   * How the instance is anchored in the room. `{ mode: "free" }` (the
   * default) means the world transform above is authoritative. `{ mode:
   * "wall", wall: {...} }` means the wall attachment is authoritative and
   * the world transform is derived by the resolver on the renderer side.
   * Optional at the type level for backward compat — legacy rows with no
   * persisted placement rehydrate through `normalizeInstancePlacement`
   * as `{ mode: "free" }`.
   */
  placement?: SceneAssetInstancePlacement;

  /**
   * Optional map of glTF material slot names (e.g. `"upholstery"`, `"frame"`)
   * to material selection IDs resolved via the existing material system.
   * Absent slots keep the asset's embedded materials.
   */
  materialOverrides?: Record<string, string>;

  createdAt: string;
  updatedAt: string;
}

export const sceneAssetInstanceSchema: z.ZodType<SceneAssetInstance> = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  roomId: z.string().min(1),
  assetDefinitionId: z.string().min(1),
  positionMm: vec3Schema,
  rotationDeg: vec3Schema,
  scale: vec3Schema,
  visible: z.boolean(),
  placement: sceneAssetInstancePlacementSchema.optional(),
  materialOverrides: z.record(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Safe scale bounds (dimensionless multipliers). Anything outside this
 *  range is either meaningless (0, negative) or destabilizes rendering /
 *  collision math (astronomically large). Enforced by the shared schema
 *  and re-validated on the server so a forged client payload can't slip
 *  through. */
export const MIN_INSTANCE_SCALE = 0.05;
export const MAX_INSTANCE_SCALE = 20;

const scaleAxisSchema = z
  .number()
  .refine((v) => Number.isFinite(v), { message: "scale must be finite" })
  .refine((v) => v >= MIN_INSTANCE_SCALE && v <= MAX_INSTANCE_SCALE, {
    message: `scale must be between ${MIN_INSTANCE_SCALE} and ${MAX_INSTANCE_SCALE}`,
  });

export const scaleVec3Schema: z.ZodType<Vec3> = z.object({
  x: scaleAxisSchema,
  y: scaleAxisSchema,
  z: scaleAxisSchema,
});

/**
 * Input shape for creating a new instance. `orgId` and `roomId` are
 * stripped — the server derives them from URL params + authenticated
 * context. `id` and timestamps come from the database. Scale is
 * optional; if omitted the server stamps identity scale.
 */
export interface SceneAssetInstanceCreateInput {
  assetDefinitionId: string;
  positionMm: Vec3;
  rotationDeg?: Vec3;
  scale?: Vec3;
  visible?: boolean;
  placement?: SceneAssetInstancePlacement;
  materialOverrides?: Record<string, string>;
}

export const sceneAssetInstanceCreateSchema: z.ZodType<SceneAssetInstanceCreateInput> = z.object({
  assetDefinitionId: z.string().min(1),
  positionMm: vec3Schema,
  rotationDeg: vec3Schema.optional(),
  scale: scaleVec3Schema.optional(),
  visible: z.boolean().optional(),
  placement: sceneAssetInstancePlacementSchema.optional(),
  materialOverrides: z.record(z.string()).optional(),
});

/** Partial update — every field is optional. Scale is allowed and is
 *  bounded by `[MIN_INSTANCE_SCALE, MAX_INSTANCE_SCALE]` on each axis;
 *  zero / negative / NaN / Infinity are rejected before persistence. */
export interface SceneAssetInstanceUpdateInput {
  positionMm?: Vec3;
  rotationDeg?: Vec3;
  scale?: Vec3;
  visible?: boolean;
  placement?: SceneAssetInstancePlacement;
  materialOverrides?: Record<string, string>;
}

export const sceneAssetInstanceUpdateSchema: z.ZodType<SceneAssetInstanceUpdateInput> = z.object({
  positionMm: vec3Schema.optional(),
  rotationDeg: vec3Schema.optional(),
  scale: scaleVec3Schema.optional(),
  visible: z.boolean().optional(),
  placement: sceneAssetInstancePlacementSchema.optional(),
  materialOverrides: z.record(z.string()).optional(),
});

/** Identity transforms — safe defaults for a freshly-placed instance. */
export const IDENTITY_ROTATION: Vec3 = { x: 0, y: 0, z: 0 };
export const IDENTITY_SCALE: Vec3 = { x: 1, y: 1, z: 1 };

/** A create input with all defaults resolved — output of `withInstanceDefaults`. */
export interface NormalizedInstanceCreate {
  assetDefinitionId: string;
  positionMm: Vec3;
  rotationDeg: Vec3;
  scale: Vec3;
  visible: boolean;
  placement: SceneAssetInstancePlacement;
  materialOverrides?: Record<string, string>;
}

/** Fills in identity rotation/scale, `visible=true`, and
 *  `placement.mode="free"` for a create input that omits them. */
export function withInstanceDefaults(
  input: SceneAssetInstanceCreateInput,
): NormalizedInstanceCreate {
  return {
    assetDefinitionId: input.assetDefinitionId,
    positionMm: input.positionMm,
    rotationDeg: input.rotationDeg ?? IDENTITY_ROTATION,
    scale: input.scale ?? IDENTITY_SCALE,
    visible: input.visible ?? true,
    placement: input.placement ?? DEFAULT_INSTANCE_PLACEMENT,
    materialOverrides: input.materialOverrides,
  };
}
