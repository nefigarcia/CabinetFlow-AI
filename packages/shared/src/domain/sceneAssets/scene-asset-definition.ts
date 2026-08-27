import { z } from "zod";
import type { SceneAssetCategory } from "./scene-asset-category";
import { sceneAssetCategorySchema } from "./scene-asset-category";
import type { SceneAssetCollision } from "./scene-asset-collision";
import { sceneAssetCollisionSchema } from "./scene-asset-collision";
import type { SceneAssetPlacement } from "./scene-asset-placement";
import { sceneAssetPlacementSchema } from "./scene-asset-placement";

// A reusable catalog entry for a Scene Asset. Definitions are shared across
// many `SceneAssetInstance`s and are safe to cache client-side.
//
// `model.assetKey` is OPAQUE — it may resolve to a local `/assets/scene/...`
// path today or a CDN/S3 URL later. Consumers must route it through
// `resolveSceneAssetUrl(assetKey)` (added in a later slice) rather than
// concatenating URLs directly. Instances never store a resolved URL.
//
// `model` is OPTIONAL. A definition without a `model` renders as a
// dimensionally-accurate primitive keyed off `category` — this lets the
// scene workflow ship and be proven before any licensed GLB assets exist
// (see Slice 2 in the epic).

/**
 * Optional deterministic overrides applied AFTER auto-normalization
 * (which fits the raw GLB into the definition's `dimensionsMm` and anchors
 * it bottom-center). Use these when the imported model needs additional
 * rotation, an origin shift, or a scale multiplier the auto-fit gets
 * slightly wrong.
 */
export interface SceneAssetModelNormalization {
  /** Uniform scale multiplier applied on top of auto-fit. Default 1. */
  scale?: number;
  /** Additional rotation (degrees), applied in the local model frame. */
  rotationDeg?: {
    x: number;
    y: number;
    z: number;
  };
  /** Additional translation (millimeters) applied in the local model frame. */
  offsetMm?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface SceneAssetModelRef {
  format: "glb" | "gltf";
  assetKey: string;
  thumbnailKey?: string;
  normalization?: SceneAssetModelNormalization;
}

const modelNormalizationSchema: z.ZodType<SceneAssetModelNormalization> = z.object({
  scale: z.number().positive().optional(),
  rotationDeg: z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .optional(),
  offsetMm: z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .optional(),
});

export const sceneAssetModelRefSchema: z.ZodType<SceneAssetModelRef> = z.object({
  format: z.enum(["glb", "gltf"]),
  assetKey: z.string().min(1),
  thumbnailKey: z.string().optional(),
  normalization: modelNormalizationSchema.optional(),
});

/** Catalog dimensions in millimeters. Mirrors CabinetDimensionsMm's naming. */
export interface SceneAssetDimensionsMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export const sceneAssetDimensionsMmSchema: z.ZodType<SceneAssetDimensionsMm> = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
});

export interface SceneAssetDefinition {
  id: string;
  version: number;

  name: string;
  category: SceneAssetCategory;

  /** Optional — absent → primitive fallback renderer picks shape by category. */
  model?: SceneAssetModelRef;

  dimensionsMm: SceneAssetDimensionsMm;

  thumbnailKey?: string;

  manufacturer?: string;
  manufacturerModel?: string;
  sku?: string;

  placement?: SceneAssetPlacement;
  collision?: SceneAssetCollision;

  metadata?: Record<string, unknown>;
}

export const sceneAssetDefinitionSchema: z.ZodType<SceneAssetDefinition> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  category: sceneAssetCategorySchema,
  model: sceneAssetModelRefSchema.optional(),
  dimensionsMm: sceneAssetDimensionsMmSchema,
  thumbnailKey: z.string().optional(),
  manufacturer: z.string().optional(),
  manufacturerModel: z.string().optional(),
  sku: z.string().optional(),
  placement: sceneAssetPlacementSchema.optional(),
  collision: sceneAssetCollisionSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** True when this definition has a GLB/glTF model registered. */
export function hasModel(definition: SceneAssetDefinition): boolean {
  return definition.model !== undefined;
}
