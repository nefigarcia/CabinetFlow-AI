import type { SceneAssetCategory } from "./scene-asset-category";
import type { SceneAssetDefinition } from "./scene-asset-definition";

// Which primitive silhouette a Scene Asset should render as when no GLB
// exists. The React renderer maps each PrimitiveShape to a small group of
// meshes sized from the definition's `dimensionsMm`.
//
// Every value is either the CATEGORY DEFAULT for a Scene Asset category or
// an EXPLICIT HINT set via `metadata.primitiveShape` on a definition. The
// hint always wins — a "furniture" definition tagged `"table"` renders as
// a table, not a generic box.

export type PrimitiveShape =
  | "box" // dimensionally accurate box — the universal fallback
  | "sofa" // seat + backrest
  | "table" // thin top + 4 legs
  | "plant" // pot + foliage
  | "rug"; // thin flat plane

const KNOWN_PRIMITIVE_SHAPES = new Set<PrimitiveShape>([
  "box",
  "sofa",
  "table",
  "plant",
  "rug",
]);

/** Per-category default silhouette. Anything unclassified falls back to a box. */
export function categoryDefaultPrimitiveShape(category: SceneAssetCategory): PrimitiveShape {
  switch (category) {
    case "rug":
      return "rug";
    case "plant":
      return "plant";
    case "furniture":
    case "appliance":
    case "plumbing":
    case "lighting":
    case "electronics":
    case "fixture":
    case "decor":
      return "box";
  }
}

/**
 * Resolves the primitive silhouette for a definition. Prefers an explicit
 * `metadata.primitiveShape` hint when present and recognized; otherwise
 * falls back to the category default.
 */
export function getPrimitiveShape(definition: SceneAssetDefinition): PrimitiveShape {
  const raw = definition.metadata?.primitiveShape;
  if (typeof raw === "string" && KNOWN_PRIMITIVE_SHAPES.has(raw as PrimitiveShape)) {
    return raw as PrimitiveShape;
  }
  return categoryDefaultPrimitiveShape(definition.category);
}
