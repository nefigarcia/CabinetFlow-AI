import { describe, expect, it } from "vitest";
import {
  getSceneAssetEffectiveDimensions,
  isInstanceScaled,
} from "../effective-dimensions";
import { IDENTITY_SCALE } from "../scene-asset-instance";

const catalog = {
  dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 600 },
};

describe("getSceneAssetEffectiveDimensions", () => {
  it("returns catalog dimensions when scale is identity", () => {
    expect(
      getSceneAssetEffectiveDimensions(catalog, { scale: IDENTITY_SCALE }),
    ).toEqual({ widthMm: 2000, heightMm: 800, depthMm: 600 });
  });

  it("returns catalog dimensions when instance lacks scale (legacy row)", () => {
    expect(getSceneAssetEffectiveDimensions(catalog, {})).toEqual({
      widthMm: 2000,
      heightMm: 800,
      depthMm: 600,
    });
  });

  it("scales uniformly", () => {
    expect(
      getSceneAssetEffectiveDimensions(catalog, {
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      }),
    ).toEqual({ widthMm: 1000, heightMm: 400, depthMm: 300 });
  });

  it("scales per axis (non-uniform)", () => {
    expect(
      getSceneAssetEffectiveDimensions(catalog, {
        scale: { x: 1.5, y: 0.5, z: 2 },
      }),
    ).toEqual({ widthMm: 3000, heightMm: 400, depthMm: 1200 });
  });

  it("handles zero-side catalog gracefully (returns zero — never NaN)", () => {
    expect(
      getSceneAssetEffectiveDimensions(
        { dimensionsMm: { widthMm: 0, heightMm: 800, depthMm: 600 } },
        { scale: IDENTITY_SCALE },
      ),
    ).toEqual({ widthMm: 0, heightMm: 800, depthMm: 600 });
  });
});

describe("isInstanceScaled", () => {
  it("returns false for identity scale", () => {
    expect(isInstanceScaled({ scale: IDENTITY_SCALE })).toBe(false);
  });

  it("returns false for legacy (no scale)", () => {
    expect(isInstanceScaled({})).toBe(false);
    expect(isInstanceScaled(null)).toBe(false);
    expect(isInstanceScaled(undefined)).toBe(false);
  });

  it("returns true when any axis differs materially from 1", () => {
    expect(isInstanceScaled({ scale: { x: 1.5, y: 1, z: 1 } })).toBe(true);
    expect(isInstanceScaled({ scale: { x: 1, y: 0.5, z: 1 } })).toBe(true);
    expect(isInstanceScaled({ scale: { x: 1, y: 1, z: 2 } })).toBe(true);
  });

  it("tolerates floating-point noise near 1 (Prisma Decimal round-trip)", () => {
    // 0.005 default tolerance — noise from Decimal(10,6) round-trip is
    // typically < 1e-6, well inside tolerance.
    expect(
      isInstanceScaled({
        scale: { x: 1.000001, y: 0.999999, z: 1.000002 },
      }),
    ).toBe(false);
  });
});
