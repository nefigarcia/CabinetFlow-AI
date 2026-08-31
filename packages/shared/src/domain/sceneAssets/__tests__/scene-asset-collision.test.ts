import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLISION,
  sceneAssetCollisionSchema,
} from "../scene-asset-collision";

describe("SceneAssetCollision", () => {
  it("requires the `enabled` flag", () => {
    expect(() => sceneAssetCollisionSchema.parse({})).toThrow();
  });

  it("accepts the minimum shape (just enabled)", () => {
    expect(() => sceneAssetCollisionSchema.parse({ enabled: true })).not.toThrow();
    expect(() => sceneAssetCollisionSchema.parse({ enabled: false })).not.toThrow();
  });

  it("accepts a full clearance envelope", () => {
    const full = {
      enabled: true,
      clearanceFrontMm: 900,
      clearanceBackMm: 50,
      clearanceLeftMm: 25,
      clearanceRightMm: 25,
      clearanceTopMm: 100,
    };
    expect(sceneAssetCollisionSchema.parse(full)).toEqual(full);
  });

  it("rejects negative clearances", () => {
    expect(() =>
      sceneAssetCollisionSchema.parse({ enabled: true, clearanceFrontMm: -50 }),
    ).toThrow();
  });

  it("accepts a clearance of zero", () => {
    expect(() =>
      sceneAssetCollisionSchema.parse({ enabled: true, clearanceFrontMm: 0 }),
    ).not.toThrow();
  });

  it("default collision is enabled with no extra clearance", () => {
    expect(DEFAULT_COLLISION).toEqual({ enabled: true });
    expect(() => sceneAssetCollisionSchema.parse(DEFAULT_COLLISION)).not.toThrow();
  });
});
