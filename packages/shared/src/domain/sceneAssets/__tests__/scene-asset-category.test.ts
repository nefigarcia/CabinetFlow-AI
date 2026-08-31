import { describe, expect, it } from "vitest";
import {
  SCENE_ASSET_CATEGORIES,
  SCENE_ASSET_CATEGORY_LABELS,
  sceneAssetCategorySchema,
} from "../scene-asset-category";

describe("SceneAssetCategory", () => {
  it("accepts every declared category", () => {
    for (const category of SCENE_ASSET_CATEGORIES) {
      expect(() => sceneAssetCategorySchema.parse(category)).not.toThrow();
    }
  });

  it("rejects unknown categories", () => {
    expect(() => sceneAssetCategorySchema.parse("cabinet")).toThrow();
    expect(() => sceneAssetCategorySchema.parse("")).toThrow();
    expect(() => sceneAssetCategorySchema.parse(123)).toThrow();
  });

  it("has a label for every category", () => {
    for (const category of SCENE_ASSET_CATEGORIES) {
      expect(SCENE_ASSET_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it("category list has no duplicates", () => {
    expect(new Set(SCENE_ASSET_CATEGORIES).size).toBe(SCENE_ASSET_CATEGORIES.length);
  });
});
