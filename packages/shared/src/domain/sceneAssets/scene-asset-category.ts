import { z } from "zod";

// Broad category for a Scene Asset — used for UI grouping, room-type
// filtering in the catalog panel, and primitive-renderer dispatch when a
// GLB is not yet available.
//
// These categories describe **visualization / reference** objects only.
// Cabinets, millwork, and any other manufacturable geometry stay in the
// Cabinet Domain and MUST NOT be represented as Scene Assets.

export type SceneAssetCategory =
  | "appliance"
  | "furniture"
  | "plumbing"
  | "lighting"
  | "decor"
  | "plant"
  | "rug"
  | "electronics"
  | "fixture";

export const sceneAssetCategorySchema: z.ZodType<SceneAssetCategory> = z.enum([
  "appliance",
  "furniture",
  "plumbing",
  "lighting",
  "decor",
  "plant",
  "rug",
  "electronics",
  "fixture",
]);

export const SCENE_ASSET_CATEGORIES: readonly SceneAssetCategory[] = [
  "appliance",
  "furniture",
  "plumbing",
  "lighting",
  "decor",
  "plant",
  "rug",
  "electronics",
  "fixture",
];

/** Human-friendly labels for each category, for use in UI. */
export const SCENE_ASSET_CATEGORY_LABELS: Record<SceneAssetCategory, string> = {
  appliance: "Appliance",
  furniture: "Furniture",
  plumbing: "Plumbing",
  lighting: "Lighting",
  decor: "Decor",
  plant: "Plant",
  rug: "Rug",
  electronics: "Electronics",
  fixture: "Fixture",
};
