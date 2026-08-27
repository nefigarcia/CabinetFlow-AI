import type { SceneAssetDefinition } from "./scene-asset-definition";

// Curated bootstrap catalog for the Scene Asset MVP (Slice 2).
//
// Dimensions are GENERIC NOMINAL values chosen to be visually plausible
// across common design flows. They do NOT represent any specific
// manufacturer or product. When a real manufacturer catalog is wired up
// in a later slice, definitions with `manufacturer` / `sku` will replace
// these placeholders.
//
// All entries deliberately omit `model` — the primitive renderer picks
// the silhouette from `metadata.primitiveShape` (or the category default).
// Real GLB assets will land in Slice 10 without changing any consumer.
//
// Every entry MUST:
//   · have a unique `id`
//   · declare positive `dimensionsMm`
//   · declare `version` starting at 1
//   · include `collision` metadata IF the asset has real clearance needs
//
// Rugs opt out of collision entirely — a rug intersecting anything is
// visually and functionally fine.

export const DEFAULT_SCENE_ASSET_CATALOG: readonly SceneAssetDefinition[] = [
  {
    id: "sofa-3seat-generic",
    version: 1,
    name: "Sofa — 3 Seat",
    category: "furniture",
    dimensionsMm: { widthMm: 2100, heightMm: 850, depthMm: 950 },
    metadata: { primitiveShape: "sofa" },
  },
  {
    id: "armchair-generic",
    version: 1,
    name: "Armchair",
    category: "furniture",
    dimensionsMm: { widthMm: 900, heightMm: 850, depthMm: 900 },
    metadata: { primitiveShape: "sofa" },
  },
  {
    id: "coffee-table-generic",
    version: 1,
    name: "Coffee Table",
    category: "furniture",
    dimensionsMm: { widthMm: 1200, heightMm: 450, depthMm: 600 },
    metadata: { primitiveShape: "table" },
  },
  {
    id: "dining-table-6-generic",
    version: 1,
    name: "Dining Table (6 Seats)",
    category: "furniture",
    dimensionsMm: { widthMm: 1800, heightMm: 750, depthMm: 900 },
    metadata: { primitiveShape: "table" },
  },
  {
    id: "bed-queen-generic",
    version: 1,
    name: "Queen Bed",
    category: "furniture",
    // Depth is the head-to-foot length; width is the mattress width.
    dimensionsMm: { widthMm: 1550, heightMm: 600, depthMm: 2100 },
  },
  {
    id: "rug-area-large-generic",
    version: 1,
    name: "Area Rug — Large",
    category: "rug",
    dimensionsMm: { widthMm: 2400, heightMm: 20, depthMm: 3000 },
    collision: { enabled: false },
  },
  {
    id: "plant-medium-generic",
    version: 1,
    name: "Potted Plant — Medium",
    category: "plant",
    dimensionsMm: { widthMm: 500, heightMm: 1400, depthMm: 500 },
  },
  {
    id: "refrigerator-36-generic",
    version: 1,
    name: 'Refrigerator (36")',
    category: "appliance",
    dimensionsMm: { widthMm: 914, heightMm: 1778, depthMm: 711 },
    collision: {
      enabled: true,
      clearanceFrontMm: 900,
      clearanceBackMm: 25,
      clearanceTopMm: 25,
    },
  },
  {
    id: "range-30-generic",
    version: 1,
    name: 'Range (30")',
    category: "appliance",
    dimensionsMm: { widthMm: 762, heightMm: 914, depthMm: 686 },
    collision: { enabled: true, clearanceFrontMm: 900 },
  },
  {
    id: "washer-generic",
    version: 1,
    name: "Washer (Front-Load)",
    category: "appliance",
    dimensionsMm: { widthMm: 686, heightMm: 965, depthMm: 864 },
    collision: { enabled: true, clearanceFrontMm: 900, clearanceBackMm: 100 },
  },
  {
    id: "dryer-generic",
    version: 1,
    name: "Dryer (Front-Load)",
    category: "appliance",
    dimensionsMm: { widthMm: 686, heightMm: 965, depthMm: 711 },
    collision: { enabled: true, clearanceFrontMm: 900, clearanceBackMm: 100 },
  },
  {
    id: "freestanding-tub-60-generic",
    version: 1,
    name: 'Freestanding Bathtub (60")',
    category: "plumbing",
    dimensionsMm: { widthMm: 1524, heightMm: 585, depthMm: 762 },
  },
];
