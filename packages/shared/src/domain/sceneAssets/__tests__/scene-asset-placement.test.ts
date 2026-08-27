import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEMENT,
  isCeilingMounted,
  isCountertopMounted,
  isFloorMounted,
  isWallMounted,
  sceneAssetPlacementSchema,
} from "../scene-asset-placement";

describe("SceneAssetPlacement", () => {
  it("accepts an empty object (all placement flags optional)", () => {
    expect(() => sceneAssetPlacementSchema.parse({})).not.toThrow();
  });

  it("accepts all flags true", () => {
    const p = {
      floorMounted: true,
      wallMounted: true,
      ceilingMounted: true,
      countertopMounted: true,
    };
    expect(sceneAssetPlacementSchema.parse(p)).toEqual(p);
  });

  it("rejects non-boolean values", () => {
    expect(() => sceneAssetPlacementSchema.parse({ floorMounted: "yes" })).toThrow();
    expect(() => sceneAssetPlacementSchema.parse({ wallMounted: 1 })).toThrow();
  });

  it("default placement is floor-mounted", () => {
    expect(DEFAULT_PLACEMENT).toEqual({ floorMounted: true });
    expect(isFloorMounted(DEFAULT_PLACEMENT)).toBe(true);
  });

  describe("mount predicates", () => {
    it("isFloorMounted defaults true when placement is undefined", () => {
      expect(isFloorMounted(undefined)).toBe(true);
    });

    it("isFloorMounted respects an explicit false", () => {
      expect(isFloorMounted({ floorMounted: false })).toBe(false);
    });

    it("isWallMounted false when unset (does NOT default)", () => {
      expect(isWallMounted(undefined)).toBe(false);
      expect(isWallMounted({})).toBe(false);
      expect(isWallMounted({ wallMounted: true })).toBe(true);
    });

    it("isCeilingMounted false when unset", () => {
      expect(isCeilingMounted(undefined)).toBe(false);
      expect(isCeilingMounted({ ceilingMounted: true })).toBe(true);
    });

    it("isCountertopMounted false when unset", () => {
      expect(isCountertopMounted(undefined)).toBe(false);
      expect(isCountertopMounted({ countertopMounted: true })).toBe(true);
    });

    it("multiple mount flags may be true simultaneously", () => {
      const p = { floorMounted: true, wallMounted: true };
      expect(isFloorMounted(p)).toBe(true);
      expect(isWallMounted(p)).toBe(true);
    });
  });
});
