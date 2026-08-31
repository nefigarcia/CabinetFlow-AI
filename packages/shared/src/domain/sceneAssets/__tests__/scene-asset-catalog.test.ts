import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import { createSceneAssetCatalog } from "../scene-asset-catalog";

function def(
  id: string,
  category: SceneAssetDefinition["category"],
  overrides: Partial<SceneAssetDefinition> = {},
): SceneAssetDefinition {
  return {
    id,
    version: 1,
    name: id,
    category,
    dimensionsMm: { widthMm: 100, heightMm: 100, depthMm: 100 },
    ...overrides,
  };
}

describe("SceneAssetCatalog", () => {
  it("listAll returns every registered definition", () => {
    const catalog = createSceneAssetCatalog([
      def("sofa-01", "furniture"),
      def("fridge-01", "appliance"),
    ]);
    expect(catalog.listAll()).toHaveLength(2);
    expect(catalog.listAll().map((d) => d.id).sort()).toEqual(["fridge-01", "sofa-01"]);
  });

  it("listAll returns a defensive copy (mutating it does not affect the catalog)", () => {
    const catalog = createSceneAssetCatalog([def("sofa-01", "furniture")]);
    const first = catalog.listAll();
    first.pop();
    expect(catalog.listAll()).toHaveLength(1);
  });

  it("findById returns the matching definition or undefined", () => {
    const sofa = def("sofa-01", "furniture");
    const catalog = createSceneAssetCatalog([sofa]);
    expect(catalog.findById("sofa-01")).toEqual(sofa);
    expect(catalog.findById("does-not-exist")).toBeUndefined();
  });

  it("listByCategory filters correctly", () => {
    const catalog = createSceneAssetCatalog([
      def("sofa-01", "furniture"),
      def("chair-01", "furniture"),
      def("fridge-01", "appliance"),
      def("range-01", "appliance"),
      def("plant-01", "plant"),
    ]);
    expect(catalog.listByCategory("furniture").map((d) => d.id).sort()).toEqual([
      "chair-01",
      "sofa-01",
    ]);
    expect(catalog.listByCategory("appliance").map((d) => d.id).sort()).toEqual([
      "fridge-01",
      "range-01",
    ]);
    expect(catalog.listByCategory("plant")).toHaveLength(1);
    expect(catalog.listByCategory("lighting")).toEqual([]);
  });

  it("categoriesPresent enumerates only categories that appear", () => {
    const catalog = createSceneAssetCatalog([
      def("sofa-01", "furniture"),
      def("chair-01", "furniture"),
      def("fridge-01", "appliance"),
    ]);
    expect(catalog.categoriesPresent().sort()).toEqual(["appliance", "furniture"]);
  });

  it("throws on duplicate definition ids", () => {
    expect(() =>
      createSceneAssetCatalog([
        def("sofa-01", "furniture"),
        def("sofa-01", "decor"),
      ]),
    ).toThrow(/duplicate/);
  });

  it("supports an empty catalog", () => {
    const catalog = createSceneAssetCatalog([]);
    expect(catalog.listAll()).toEqual([]);
    expect(catalog.categoriesPresent()).toEqual([]);
    expect(catalog.findById("anything")).toBeUndefined();
  });
});
