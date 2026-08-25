import { z } from "zod";
import type { MaterialCategory } from "./material-category";
import { materialCategorySchema } from "./material-category";

// The render-time material profile consumed by the browser Three.js layer.
// Complements the manufacturing `MaterialProfile` at
// packages/shared/src/domain/profiles/material.ts — they live side by side
// because the manufacturing shape carries thickness, edge banding, and cost
// while this shape carries color, roughness, texture URLs, and grain
// scaling for rendering. Both may reference the same `id` when a shop
// material has both roles; the split keeps concerns clean.
//
// The V2.5 persistent shop-profile milestone will unify these under a
// single organization-scoped MaterialCatalog record. Until then this
// browser-side shape is a runtime-only concept.

export type MaterialFinish = "matte" | "satin" | "semi-gloss" | "gloss";
export type MaterialGrainDirection = "horizontal" | "vertical" | "none";

export interface MaterialTextureMap {
  /** Base color / albedo map, typically sRGB. */
  albedoUrl?: string;
  /** Tangent-space normal map. */
  normalUrl?: string;
  /** Grayscale roughness map. */
  roughnessUrl?: string;
  /** Grayscale metalness map. */
  metalnessUrl?: string;
  /** Optional ambient occlusion map. */
  aoUrl?: string;
}

export interface MaterialRenderProfile {
  id: string;
  version: number;
  name: string;
  category: MaterialCategory;

  /** Fallback color used when texture maps are absent or still loading. */
  baseColorHex: string;

  /** [0..1]. `MeshStandardMaterial.roughness`. */
  roughness: number;

  /** [0..1]. `MeshStandardMaterial.metalness`. */
  metalness: number;

  /**
   * Physical tile size in millimeters. If a wood-grain image tiles at
   * 900 mm real-world, a 1800 mm-wide door face receives 2 tiles.
   * When omitted, the resolver falls back to the category default.
   */
  scaleMm?: number;

  grainDirection?: MaterialGrainDirection;
  finish?: MaterialFinish;

  textures?: MaterialTextureMap;

  /** Optional thumbnail URL for UI swatches. */
  thumbnailUrl?: string;

  /** Optional transparency [0..1]. `1` = opaque. */
  opacity?: number;
}

export const materialTextureMapSchema: z.ZodType<MaterialTextureMap> = z.object({
  albedoUrl: z.string().optional(),
  normalUrl: z.string().optional(),
  roughnessUrl: z.string().optional(),
  metalnessUrl: z.string().optional(),
  aoUrl: z.string().optional(),
});

export const materialRenderProfileSchema: z.ZodType<MaterialRenderProfile> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  category: materialCategorySchema,

  baseColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb"),

  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),

  scaleMm: z.number().positive().optional(),
  grainDirection: z.enum(["horizontal", "vertical", "none"]).optional(),
  finish: z.enum(["matte", "satin", "semi-gloss", "gloss"]).optional(),

  textures: materialTextureMapSchema.optional(),
  thumbnailUrl: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
