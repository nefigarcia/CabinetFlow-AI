import type { MaterialCategory } from "./material-category";
import type { MaterialRenderProfile } from "./material-render-profile";

// Curated MVP demo catalog. All entries are base-color-only for the initial
// release; texture URLs can be added as real asset files land under
// apps/web/public/assets/materials/. IDs are stable and used by
// MaterialSelection to reference a profile.

const P = <T extends MaterialRenderProfile>(p: T): T => p;

export const DEMO_MATERIAL_REGISTRY: readonly MaterialRenderProfile[] = [
  // ── Painted ─────────────────────────────────────────────────────────────
  P({
    id: "painted-white",
    version: 1,
    name: "Painted White",
    category: "painted",
    baseColorHex: "#f0f0f0",
    roughness: 0.55,
    metalness: 0.02,
    finish: "satin",
  }),
  P({
    id: "painted-black",
    version: 1,
    name: "Painted Black",
    category: "painted",
    baseColorHex: "#26262a",
    roughness: 0.5,
    metalness: 0.05,
    finish: "satin",
  }),
  P({
    id: "painted-navy",
    version: 1,
    name: "Painted Navy",
    category: "painted",
    baseColorHex: "#20364e",
    roughness: 0.5,
    metalness: 0.04,
    finish: "satin",
  }),
  P({
    id: "painted-sage",
    version: 1,
    name: "Painted Sage",
    category: "painted",
    baseColorHex: "#8a9a80",
    roughness: 0.55,
    metalness: 0.02,
    finish: "matte",
  }),

  // ── Wood ────────────────────────────────────────────────────────────────
  P({
    id: "wood-white-oak",
    version: 1,
    name: "White Oak",
    category: "wood",
    baseColorHex: "#c49a62",
    roughness: 0.7,
    metalness: 0.02,
    scaleMm: 900,
    grainDirection: "vertical",
    finish: "satin",
  }),
  P({
    id: "wood-walnut",
    version: 1,
    name: "Walnut",
    category: "wood",
    baseColorHex: "#6b5035",
    roughness: 0.65,
    metalness: 0.02,
    scaleMm: 900,
    grainDirection: "vertical",
    finish: "satin",
  }),
  P({
    id: "wood-maple",
    version: 1,
    name: "Maple",
    category: "wood",
    baseColorHex: "#e6cfa2",
    roughness: 0.7,
    metalness: 0.02,
    scaleMm: 900,
    grainDirection: "vertical",
    finish: "satin",
  }),
  P({
    id: "wood-dark-walnut",
    version: 1,
    name: "Dark Walnut",
    category: "wood",
    baseColorHex: "#3d2e1e",
    roughness: 0.6,
    metalness: 0.03,
    scaleMm: 900,
    grainDirection: "vertical",
    finish: "semi-gloss",
  }),

  // ── Laminate ────────────────────────────────────────────────────────────
  P({
    id: "laminate-gloss-black",
    version: 1,
    name: "High-Gloss Black Laminate",
    category: "laminate",
    baseColorHex: "#141416",
    roughness: 0.15,
    metalness: 0.35,
    finish: "gloss",
  }),

  // ── Stone (countertops) ─────────────────────────────────────────────────
  P({
    id: "stone-quartz-white",
    version: 1,
    name: "Quartz White",
    category: "stone",
    baseColorHex: "#eae2d0",
    roughness: 0.35,
    metalness: 0.05,
    scaleMm: 1600,
    finish: "semi-gloss",
  }),
  P({
    id: "stone-quartz-gray",
    version: 1,
    name: "Quartz Gray",
    category: "stone",
    baseColorHex: "#8e8f8f",
    roughness: 0.35,
    metalness: 0.05,
    scaleMm: 1600,
    finish: "semi-gloss",
  }),

  // ── Floors ──────────────────────────────────────────────────────────────
  P({
    id: "floor-oak-gray",
    version: 1,
    name: "Gray-Washed Oak Floor",
    category: "floor",
    baseColorHex: "#9a8f80",
    roughness: 0.75,
    metalness: 0.02,
    scaleMm: 900,
    grainDirection: "horizontal",
    finish: "matte",
  }),
  P({
    id: "floor-walnut",
    version: 1,
    name: "Walnut Floor",
    category: "floor",
    baseColorHex: "#5a3e28",
    roughness: 0.75,
    metalness: 0.02,
    scaleMm: 900,
    grainDirection: "horizontal",
    finish: "matte",
  }),

  // ── Backsplash ──────────────────────────────────────────────────────────
  P({
    id: "backsplash-subway-white",
    version: 1,
    name: "White Subway Tile",
    category: "backsplash",
    baseColorHex: "#efefec",
    roughness: 0.35,
    metalness: 0.04,
    scaleMm: 150,
    finish: "semi-gloss",
  }),
  P({
    id: "backsplash-stone-light",
    version: 1,
    name: "Light Stone Slab",
    category: "backsplash",
    baseColorHex: "#c8beb0",
    roughness: 0.5,
    metalness: 0.04,
    scaleMm: 1600,
    finish: "matte",
  }),

  // ── Walls ───────────────────────────────────────────────────────────────
  P({
    id: "wall-light-gray",
    version: 1,
    name: "Light Gray Wall",
    category: "wall",
    baseColorHex: "#d6d3ce",
    roughness: 0.9,
    metalness: 0,
    finish: "matte",
  }),
  P({
    id: "wall-dark-gray",
    version: 1,
    name: "Dark Gray Wall",
    category: "wall",
    baseColorHex: "#3a3d42",
    roughness: 0.9,
    metalness: 0,
    finish: "matte",
  }),

  // ── Metal (hardware / appliances) ───────────────────────────────────────
  P({
    id: "metal-stainless",
    version: 1,
    name: "Stainless Steel",
    category: "metal",
    baseColorHex: "#c8ced4",
    roughness: 0.3,
    metalness: 0.9,
    finish: "satin",
  }),
  P({
    id: "metal-matte-black",
    version: 1,
    name: "Matte Black Metal",
    category: "hardware",
    baseColorHex: "#232326",
    roughness: 0.5,
    metalness: 0.75,
    finish: "matte",
  }),
];

const REGISTRY_MAP = new Map<string, MaterialRenderProfile>(
  DEMO_MATERIAL_REGISTRY.map((m) => [m.id, m]),
);

export function findMaterial(id: string): MaterialRenderProfile | undefined {
  return REGISTRY_MAP.get(id);
}

export function materialsByCategory(category: MaterialCategory): MaterialRenderProfile[] {
  return DEMO_MATERIAL_REGISTRY.filter((m) => m.category === category);
}

/**
 * Global fallback profile per category. Used by the resolver when no user
 * selection and no cabinet/room default is found for a slot. Guarantees
 * the resolver never returns undefined for a covered slot.
 */
export const DEFAULT_MATERIAL_ID_BY_CATEGORY: Record<MaterialCategory, string> = {
  painted: "painted-white",
  wood: "wood-white-oak",
  laminate: "laminate-gloss-black",
  stone: "stone-quartz-white",
  metal: "metal-stainless",
  wall: "wall-light-gray",
  floor: "floor-oak-gray",
  backsplash: "backsplash-subway-white",
  // "metal-matte-black" is the only profile that already carries the
  // "hardware" category. Callers who want brushed-nickel-style pulls set
  // a per-slot cabinet override; the global default is intentionally the
  // subtler, hardware-tagged option so pulls read on cabinet fronts.
  hardware: "metal-matte-black",
};
