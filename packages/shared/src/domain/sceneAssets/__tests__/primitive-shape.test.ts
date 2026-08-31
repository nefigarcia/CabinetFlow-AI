import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import {
  categoryDefaultPrimitiveShape,
  getPrimitiveShape,
} from "../primitive-shape";

function def(overrides: Partial<SceneAssetDefinition>): SceneAssetDefinition {
  return {
    id: "test",
    version: 1,
    name: "test",
    category: "furniture",
    dimensionsMm: { widthMm: 1, heightMm: 1, depthMm: 1 },
    ...overrides,
  };
}

describe("categoryDefaultPrimitiveShape", () => {
  it("rug → rug", () => {
    expect(categoryDefaultPrimitiveShape("rug")).toBe("rug");
  });

  it("plant → plant", () => {
    expect(categoryDefaultPrimitiveShape("plant")).toBe("plant");
  });

  it.each([
    "furniture",
    "appliance",
    "plumbing",
    "lighting",
    "electronics",
    "fixture",
    "decor",
  ] as const)("%s → box", (category) => {
    expect(categoryDefaultPrimitiveShape(category)).toBe("box");
  });
});

describe("getPrimitiveShape", () => {
  it("uses the category default when no metadata hint is present", () => {
    expect(getPrimitiveShape(def({ category: "rug" }))).toBe("rug");
    expect(getPrimitiveShape(def({ category: "furniture" }))).toBe("box");
  });

  it("prefers a valid metadata.primitiveShape hint over the category default", () => {
    expect(
      getPrimitiveShape(
        def({ category: "furniture", metadata: { primitiveShape: "sofa" } }),
      ),
    ).toBe("sofa");

    expect(
      getPrimitiveShape(
        def({ category: "furniture", metadata: { primitiveShape: "table" } }),
      ),
    ).toBe("table");
  });

  it("ignores an unknown metadata.primitiveShape hint (falls back to category default)", () => {
    expect(
      getPrimitiveShape(
        def({ category: "furniture", metadata: { primitiveShape: "bogus" } }),
      ),
    ).toBe("box");
  });

  it("ignores non-string metadata.primitiveShape", () => {
    expect(
      getPrimitiveShape(
        def({ category: "rug", metadata: { primitiveShape: 123 } }),
      ),
    ).toBe("rug");
  });

  it("tolerates a definition without metadata", () => {
    expect(getPrimitiveShape(def({ category: "plant" }))).toBe("plant");
  });
});
