// Regression: GLB renderer must not fall back to the primitive proxy
// when a valid GLB is registered on the definition. Encodes the invariant
// that:
//   hasModel(def) is TRUE  ↔  def.model is present
// and the URL composer produces a non-null URL for valid keys — i.e.
// the SceneAssetItem dispatch (`hasModel(def) && resolveSceneAssetUrl`
// returning a URL) picks the GLB path, not the primitive fallback.

import { describe, expect, it } from "vitest";
import { hasModel } from "../scene-asset-definition";
import { composeSceneAssetUrl } from "../asset-url";

describe("hasModel — dispatch predicate", () => {
  it("returns true when the definition has a model assetKey", () => {
    expect(
      hasModel({
        id: "chair",
        version: 1,
        name: "Chair",
        category: "furniture",
        dimensionsMm: { widthMm: 500, heightMm: 900, depthMm: 550 },
        model: { assetKey: "furniture/chair/v1/model.glb" },
      }),
    ).toBe(true);
  });

  it("returns false when the definition has no model", () => {
    expect(
      hasModel({
        id: "primitive",
        version: 1,
        name: "Primitive",
        category: "furniture",
        dimensionsMm: { widthMm: 500, heightMm: 900, depthMm: 550 },
      }),
    ).toBe(false);
  });

  it("URL composer resolves valid key → GLB path taken (no primitive fallback)", () => {
    const url = composeSceneAssetUrl(
      "https://cdn.example.com",
      "furniture/chair/v1/model.glb",
    );
    expect(url).toBe("https://cdn.example.com/scene/furniture/chair/v1/model.glb");
  });

  it("URL composer returns null for empty / invalid key → primitive fallback is correct", () => {
    expect(composeSceneAssetUrl("https://cdn.example.com", "")).toBeNull();
    expect(composeSceneAssetUrl("https://cdn.example.com", null)).toBeNull();
    expect(
      composeSceneAssetUrl("https://cdn.example.com", "scene/already-prefixed"),
    ).toBeNull();
  });
});
