import type { SceneAssetCategory } from "./scene-asset-category";
import type { SceneAssetDefinition } from "./scene-asset-definition";
import type { RoomType } from "./room-type";
import { getRecommendedCategoriesForRoomType } from "./room-type-catalog-policy";

// Pure catalog filter / search helpers.
//
// Kept out of React so the filtering rules stay testable independently of
// any store or component. Every helper returns a NEW array; no input is
// mutated.

/** Returns only definitions in the given category. */
export function filterCatalogByCategory(
  definitions: readonly SceneAssetDefinition[],
  category: SceneAssetCategory,
): SceneAssetDefinition[] {
  return definitions.filter((d) => d.category === category);
}

/**
 * Returns definitions belonging to any category recommended for the given
 * room type. For `custom`, this is every category — so the result equals
 * the full catalog. Never filters by manufacturer / metadata / other fields.
 */
export function filterCatalogForRoomType(
  definitions: readonly SceneAssetDefinition[],
  roomType: RoomType,
): SceneAssetDefinition[] {
  const allowed = new Set<SceneAssetCategory>(
    getRecommendedCategoriesForRoomType(roomType),
  );
  return definitions.filter((d) => allowed.has(d.category));
}

// ── Local search ─────────────────────────────────────────────────────────

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Case-insensitive substring match across:
 *   · definition.name
 *   · definition.category
 *   · definition.manufacturer
 *   · definition.manufacturerModel
 *   · definition.sku
 *   · string values inside definition.metadata
 *
 * Deliberately simple — no fuzzy matching, no token weighting. The
 * catalog is small (~12 entries in Slice 4); a plain includes() is enough.
 * An empty / whitespace query returns the input unchanged.
 */
export function searchCatalog(
  definitions: readonly SceneAssetDefinition[],
  query: string,
): SceneAssetDefinition[] {
  const q = normalizeForSearch(query);
  if (q.length === 0) return definitions.slice();

  return definitions.filter((d) => {
    const haystacks: string[] = [d.name, d.category];
    if (d.manufacturer) haystacks.push(d.manufacturer);
    if (d.manufacturerModel) haystacks.push(d.manufacturerModel);
    if (d.sku) haystacks.push(d.sku);
    if (d.metadata) {
      for (const value of Object.values(d.metadata)) {
        if (typeof value === "string") haystacks.push(value);
      }
    }
    for (const h of haystacks) {
      if (normalizeForSearch(h).includes(q)) return true;
    }
    return false;
  });
}
