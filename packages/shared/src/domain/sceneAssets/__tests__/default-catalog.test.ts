import { describe, expect, it } from "vitest";
import { DEFAULT_SCENE_ASSET_CATALOG } from "../default-catalog";
import { sceneAssetDefinitionSchema } from "../scene-asset-definition";
import { createSceneAssetCatalog } from "../scene-asset-catalog";

describe("DEFAULT_SCENE_ASSET_CATALOG", () => {
  it("has at least 10 curated entries", () => {
    expect(DEFAULT_SCENE_ASSET_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry passes the SceneAssetDefinition schema", () => {
    for (const def of DEFAULT_SCENE_ASSET_CATALOG) {
      expect(() => sceneAssetDefinitionSchema.parse(def)).not.toThrow();
    }
  });

  it("every entry has strictly positive dimensions in millimeters", () => {
    for (const def of DEFAULT_SCENE_ASSET_CATALOG) {
      expect(def.dimensionsMm.widthMm).toBeGreaterThan(0);
      expect(def.dimensionsMm.heightMm).toBeGreaterThan(0);
      expect(def.dimensionsMm.depthMm).toBeGreaterThan(0);
    }
  });

  it("no duplicate ids", () => {
    const ids = DEFAULT_SCENE_ASSET_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no entry declares a `model` (Slice 2 renders primitives only)", () => {
    for (const def of DEFAULT_SCENE_ASSET_CATALOG) {
      expect(def.model).toBeUndefined();
    }
  });

  it("can be handed straight to `createSceneAssetCatalog`", () => {
    const catalog = createSceneAssetCatalog(DEFAULT_SCENE_ASSET_CATALOG);
    expect(catalog.listAll()).toHaveLength(DEFAULT_SCENE_ASSET_CATALOG.length);
    expect(catalog.findById("sofa-3seat-generic")).toBeDefined();
    expect(catalog.findById("does-not-exist")).toBeUndefined();
  });

  it("includes at least one entry per required MVP category", () => {
    const catalog = createSceneAssetCatalog(DEFAULT_SCENE_ASSET_CATALOG);
    // Per Slice 2 spec: furniture, rug, plant, appliance, plumbing.
    expect(catalog.listByCategory("furniture").length).toBeGreaterThan(0);
    expect(catalog.listByCategory("rug").length).toBeGreaterThan(0);
    expect(catalog.listByCategory("plant").length).toBeGreaterThan(0);
    expect(catalog.listByCategory("appliance").length).toBeGreaterThan(0);
    expect(catalog.listByCategory("plumbing").length).toBeGreaterThan(0);
  });
});
