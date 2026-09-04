import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import {
  hasModel,
  sceneAssetDefinitionSchema,
  sceneAssetDimensionsMmSchema,
  sceneAssetModelRefSchema,
} from "../scene-asset-definition";

function minimalDefinition(): SceneAssetDefinition {
  return {
    id: "sofa-modern-01",
    version: 1,
    name: "Sofa — Modern 3-Seat",
    category: "furniture",
    dimensionsMm: { widthMm: 2400, heightMm: 850, depthMm: 950 },
  };
}

function fullDefinition(): SceneAssetDefinition {
  return {
    id: "fridge-36-cd",
    version: 2,
    name: "Refrigerator 36\" Counter-Depth",
    category: "appliance",
    model: {
      format: "glb",
      assetKey: "scene-assets/appliances/fridge-36-cd/model.glb",
    },
    dimensionsMm: { widthMm: 914, heightMm: 1778, depthMm: 610 },
    thumbnailKey: "scene-assets/appliances/fridge-36-cd/thumbnail.webp",
    manufacturer: "Acme Appliances",
    manufacturerModel: "AF-36CD-2026",
    sku: "AF36CD",
    placement: { floorMounted: true },
    collision: {
      enabled: true,
      clearanceBackMm: 50,
      clearanceFrontMm: 900,
      clearanceTopMm: 25,
    },
    metadata: { energyRating: "A++" },
  };
}

describe("SceneAssetDefinition — schema + helpers", () => {
  it("parses a minimal definition (no model, no metadata)", () => {
    const def = minimalDefinition();
    expect(sceneAssetDefinitionSchema.parse(def)).toEqual(def);
  });

  it("parses a fully-populated definition", () => {
    const def = fullDefinition();
    expect(sceneAssetDefinitionSchema.parse(def)).toEqual(def);
  });

  it("round-trips through JSON without losing information", () => {
    const def = fullDefinition();
    const round = sceneAssetDefinitionSchema.parse(JSON.parse(JSON.stringify(def)));
    expect(round).toEqual(def);
  });

  it("accepts an `active` boolean (used by the DB Asset Library)", () => {
    const def: SceneAssetDefinition = { ...minimalDefinition(), active: false };
    const parsed = sceneAssetDefinitionSchema.parse(def);
    expect(parsed.active).toBe(false);
  });

  it("rejects a definition missing required fields", () => {
    const bad = { ...minimalDefinition() } as Partial<SceneAssetDefinition>;
    delete bad.name;
    expect(() => sceneAssetDefinitionSchema.parse(bad)).toThrow();
  });

  it("rejects zero or negative dimensions", () => {
    expect(() =>
      sceneAssetDimensionsMmSchema.parse({ widthMm: 0, heightMm: 100, depthMm: 100 }),
    ).toThrow();
    expect(() =>
      sceneAssetDimensionsMmSchema.parse({ widthMm: -1, heightMm: 100, depthMm: 100 }),
    ).toThrow();
  });

  it("rejects non-integer or non-positive version", () => {
    const bad = { ...minimalDefinition(), version: 0 };
    expect(() => sceneAssetDefinitionSchema.parse(bad)).toThrow();
    const bad2 = { ...minimalDefinition(), version: 1.5 };
    expect(() => sceneAssetDefinitionSchema.parse(bad2)).toThrow();
  });

  it("rejects unknown model format", () => {
    expect(() =>
      sceneAssetModelRefSchema.parse({ format: "fbx", assetKey: "x" }),
    ).toThrow();
  });

  it("rejects empty assetKey", () => {
    expect(() =>
      sceneAssetModelRefSchema.parse({ format: "glb", assetKey: "" }),
    ).toThrow();
  });

  describe("hasModel", () => {
    it("returns false for definitions without a model", () => {
      expect(hasModel(minimalDefinition())).toBe(false);
    });

    it("returns true for definitions with a model", () => {
      expect(hasModel(fullDefinition())).toBe(true);
    });
  });
});
