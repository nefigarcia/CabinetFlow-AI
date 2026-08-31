import type { SceneAssetCategory } from "./scene-asset-category";
import type { SceneAssetDefinition } from "./scene-asset-definition";

// Read-only lookup surface for a set of SceneAssetDefinitions.
//
// Backed by either a local static array (MVP) or a server-fed cache. Consumers
// never mutate the underlying definitions; the arrays returned by `listAll` /
// `listByCategory` are defensive shallow copies.

export interface SceneAssetCatalog {
  listAll(): SceneAssetDefinition[];
  findById(id: string): SceneAssetDefinition | undefined;
  listByCategory(category: SceneAssetCategory): SceneAssetDefinition[];
  categoriesPresent(): SceneAssetCategory[];
}

/**
 * Builds an in-memory catalog. Throws when two definitions share the same
 * `id` — duplicate IDs would silently shadow each other in `findById`.
 */
export function createSceneAssetCatalog(
  definitions: readonly SceneAssetDefinition[],
): SceneAssetCatalog {
  const byId = new Map<string, SceneAssetDefinition>();
  for (const def of definitions) {
    if (byId.has(def.id)) {
      throw new Error(`SceneAssetCatalog: duplicate definition id "${def.id}"`);
    }
    byId.set(def.id, def);
  }
  const all: SceneAssetDefinition[] = Array.from(byId.values());

  return {
    listAll: () => all.slice(),
    findById: (id) => byId.get(id),
    listByCategory: (category) => all.filter((d) => d.category === category),
    categoriesPresent: () => {
      const set = new Set<SceneAssetCategory>();
      for (const d of all) set.add(d.category);
      return Array.from(set);
    },
  };
}
