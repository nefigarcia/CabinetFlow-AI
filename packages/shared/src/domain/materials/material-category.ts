import { z } from "zod";

// A rendering-oriented category that classifies materials by the physical
// surface family they represent. Independent of the manufacturing
// MaterialProfile's `materialType` (plywood/mdf/etc) — this one drives
// texture-tiling defaults, roughness/metalness ranges, and UI grouping.

export type MaterialCategory =
  | "painted"
  | "wood"
  | "laminate"
  | "stone"
  | "metal"
  | "wall"
  | "floor"
  | "backsplash"
  | "hardware";

export const materialCategorySchema: z.ZodType<MaterialCategory> = z.enum([
  "painted",
  "wood",
  "laminate",
  "stone",
  "metal",
  "wall",
  "floor",
  "backsplash",
  "hardware",
]);

export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  "painted",
  "wood",
  "laminate",
  "stone",
  "metal",
  "wall",
  "floor",
  "backsplash",
  "hardware",
];

/** Default real-world tile size in mm for a given category. Used when a
 *  MaterialRenderProfile omits an explicit `scaleMm`. */
export const CATEGORY_DEFAULT_SCALE_MM: Record<MaterialCategory, number> = {
  painted: 0, // solid color; no tiling
  wood: 900, // ~3 ft board face for a natural wood grain
  laminate: 1200,
  stone: 1600, // large slab-scale veining
  metal: 0, // solid color / brushed micro-detail
  wall: 2400, // large wall paint area
  floor: 600, // one plank / one tile
  backsplash: 300, // subway-tile scale
  hardware: 0,
};
