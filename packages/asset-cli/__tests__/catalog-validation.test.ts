import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENE_ASSET_CATALOG,
  type SceneAssetDefinition,
} from "@woodcraft/shared";
import { validateCatalog } from "../src/catalog-validation";

// The shipping default catalog must be clean at all times — CI runs
// this same helper. Primitive-only entries (no `model`) are exempt from
// provenance / assetKey checks.
describe("validateCatalog — DEFAULT_SCENE_ASSET_CATALOG", () => {
  it("has zero issues", () => {
    expect(validateCatalog(DEFAULT_SCENE_ASSET_CATALOG)).toEqual([]);
  });
});

// Focused regression tests using fabricated inputs.
function primitive(id: string, extras: Partial<SceneAssetDefinition> = {}): SceneAssetDefinition {
  return {
    id,
    version: 1,
    name: id,
    category: "furniture",
    dimensionsMm: { widthMm: 1000, heightMm: 800, depthMm: 500 },
    ...extras,
  };
}

describe("validateCatalog — fabricated inputs", () => {
  it("flags a modeled definition missing provenance", () => {
    const issues = validateCatalog([
      primitive("bad", {
        model: {
          format: "glb",
          assetKey: "furniture/bad/v1/model.glb",
        },
      }),
    ]);
    expect(issues.some((i) => i.code === "MISSING_PROVENANCE")).toBe(true);
  });

  it("flags an inline `scene/` prefix in the assetKey", () => {
    const issues = validateCatalog([
      primitive("prefixed", {
        model: {
          format: "glb",
          // BAD — must be logical, not physical.
          assetKey: "scene/furniture/prefixed/v1/model.glb",
        },
        provenance: { sourceName: "In-house", license: "In-house" },
      }),
    ]);
    expect(issues.some((i) => i.code === "MALFORMED_ASSET_KEY")).toBe(true);
  });

  it("flags a path-traversal assetKey", () => {
    const issues = validateCatalog([
      primitive("traversal", {
        model: { format: "glb", assetKey: "../secret.glb" },
        provenance: { sourceName: "x", license: "x" },
      }),
    ]);
    expect(issues.some((i) => i.code === "MALFORMED_ASSET_KEY")).toBe(true);
  });

  it("flags an unsupported model format", () => {
    const issues = validateCatalog([
      primitive("bad-format", {
        model: {
          format: "obj" as unknown as "glb",
          assetKey: "furniture/bad/v1/model.obj",
        },
        provenance: { sourceName: "x", license: "x" },
      }),
    ]);
    expect(issues.some((i) => i.code === "UNSUPPORTED_MODEL_FORMAT")).toBe(true);
  });

  it("flags duplicate ids", () => {
    const issues = validateCatalog([primitive("dup"), primitive("dup")]);
    expect(issues.filter((i) => i.code === "DUPLICATE_ID")).toHaveLength(1);
  });

  it("passes primitive-only entries without model or provenance", () => {
    const issues = validateCatalog([primitive("prim")]);
    expect(issues).toEqual([]);
  });
});
