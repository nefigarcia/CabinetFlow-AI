import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import { computeNormalizationTransform } from "../glb-normalization";

function def(overrides: Partial<SceneAssetDefinition> = {}): SceneAssetDefinition {
  return {
    id: "sofa",
    version: 1,
    name: "Sofa",
    category: "furniture",
    dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 1000 },
    ...overrides,
  };
}

describe("computeNormalizationTransform", () => {
  it("scales a unit-cube raw bbox to fit the catalog envelope (uniform, limited by tightest axis)", () => {
    const raw = {
      min: { x: -1, y: 0, z: -1 },
      max: { x: 1, y: 2, z: 1 },
    };
    // Target: 2.0 m width, 0.8 m height, 1.0 m depth.
    // Auto-scale = min(2/2, 0.8/2, 1/2) = 0.4 (height is tightest).
    const t = computeNormalizationTransform(raw, def());
    expect(t.scale).toBeCloseTo(0.4, 6);
  });

  it("centers the raw bbox on X/Z and lifts bottom-Y to 0", () => {
    // Raw model centered at (5, 3, -2) in world, span 2 in each axis.
    const raw = {
      min: { x: 4, y: 2, z: -3 },
      max: { x: 6, y: 4, z: -1 },
    };
    const t = computeNormalizationTransform(raw, def());
    // Scaled center X = 5 * scale; scaled min Y = 2 * scale; scaled center Z = -2 * scale.
    // Offset should be (-scaledCenterX, -scaledMinY, -scaledCenterZ)
    const scale = t.scale;
    expect(t.offsetMeters.x).toBeCloseTo(-5 * scale, 6);
    expect(t.offsetMeters.y).toBeCloseTo(-2 * scale, 6);
    expect(t.offsetMeters.z).toBeCloseTo(2 * scale, 6);
  });

  it("emits identity rotation when no override", () => {
    const t = computeNormalizationTransform(
      { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } },
      def(),
    );
    expect(t.rotationRad).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("applies definition.model.normalization.scale as multiplier on autoScale", () => {
    const raw = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };
    const t = computeNormalizationTransform(
      raw,
      def({
        model: { format: "glb", assetKey: "x", normalization: { scale: 2 } },
      }),
    );
    // Base auto-scale 0.4 × 2 = 0.8
    expect(t.scale).toBeCloseTo(0.8, 6);
  });

  it("applies definition.model.normalization.offsetMm (converted to meters) on top of the auto offset", () => {
    const raw = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };
    const t = computeNormalizationTransform(
      raw,
      def({
        model: {
          format: "glb",
          assetKey: "x",
          normalization: { offsetMm: { x: 50, y: 0, z: 100 } },
        },
      }),
    );
    // Extra 0.05 m X, 0.10 m Z
    // Raw center was at (0,1,0) — scaled offset for center should be 0.
    expect(t.offsetMeters.x).toBeCloseTo(0.05, 6);
    expect(t.offsetMeters.z).toBeCloseTo(0.1, 6);
  });

  it("applies definition.model.normalization.rotationDeg converted to radians", () => {
    const t = computeNormalizationTransform(
      { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } },
      def({
        model: {
          format: "glb",
          assetKey: "x",
          normalization: { rotationDeg: { x: 0, y: 90, z: 0 } },
        },
      }),
    );
    expect(t.rotationRad.y).toBeCloseTo(Math.PI / 2, 6);
  });

  it("returns identity transform (scale=1) for a zero-volume raw bbox", () => {
    const t = computeNormalizationTransform(
      { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      def(),
    );
    expect(t.scale).toBe(1);
    expect(t.offsetMeters).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("does not mutate the input bbox or definition", () => {
    const raw = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };
    const d = def({
      model: {
        format: "glb",
        assetKey: "x",
        normalization: { scale: 2, rotationDeg: { x: 0, y: 45, z: 0 } },
      },
    });
    const snap = JSON.stringify({ raw, d });
    computeNormalizationTransform(raw, d);
    expect(JSON.stringify({ raw, d })).toBe(snap);
  });
});
