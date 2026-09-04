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

/**
 * Non-rendering provenance/licensing metadata for a Scene Asset. Kept
 * explicit so the catalog can prove where every model came from and
 * under what license — critical when shipping third-party GLBs.
 *
 * Not persisted in Prisma yet — definitions live in shared code, and
 * this rides along with the rest of the catalog entry.
 */
export interface SceneAssetProvenance {
  /** Human-readable source name (e.g. "Poly Haven", "Sketchfab", "In-house"). */
  sourceName: string;
  /** Direct URL to the source page for auditing. Optional but recommended. */
  sourceUrl?: string;
  /** SPDX-style license identifier or plain string. Examples: "CC0-1.0",
   *  "CC-BY-4.0", "In-house / proprietary". Required — no mystery assets. */
  license: string;
  /** Original author / creator when known. */
  author?: string;
  /** ISO date the file was downloaded / created in-house. Optional. */
  acquiredAt?: string;
  /** Free-form notes (e.g. "modifications: decimated to 25k tris"). */
  notes?: string;
}

const sceneAssetProvenanceSchema: z.ZodType<SceneAssetProvenance> = z.object({
  sourceName: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  license: z.string().min(1),
  author: z.string().optional(),
  acquiredAt: z.string().optional(),
  notes: z.string().optional(),
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

  /**
   * Provenance + license metadata. Required whenever `model` is set —
   * enforced by the runtime helper `assertDefinitionLicensing`. Not
   * enforced at parse time so primitive-only catalog entries can still
   * be authored without provenance.
   */
  provenance?: SceneAssetProvenance;

  /**
   * Availability flag. `true` (or unset) → new placements allowed +
   * catalog surfaces the entry. `false` → archived; the render path
   * still resolves the definition so existing rooms keep working, but
   * the catalog UI hides it and the server rejects new placements.
   * Optional so the legacy static catalog (which has no archive
   * concept) parses cleanly.
   */
  active?: boolean;

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
  provenance: sceneAssetProvenanceSchema.optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Runtime check enforced by upload/build tooling: any definition with a
 *  registered `model` MUST carry provenance. Returns a list of missing
 *  ids so a CI script can fail loudly. */
export function findModeledDefinitionsMissingProvenance(
  definitions: readonly SceneAssetDefinition[],
): string[] {
  return definitions.filter((d) => d.model && !d.provenance).map((d) => d.id);
}

export { sceneAssetProvenanceSchema };

/** True when this definition has a GLB/glTF model registered. */
export function hasModel(definition: SceneAssetDefinition): boolean {
  return definition.model !== undefined;
}
