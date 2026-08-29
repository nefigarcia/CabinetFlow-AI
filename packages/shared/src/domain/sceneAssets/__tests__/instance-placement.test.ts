import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSTANCE_PLACEMENT,
  isWallAttached,
  normalizeInstancePlacement,
  sceneAssetInstancePlacementSchema,
} from "../instance-placement";

describe("instance-placement", () => {
  describe("schema", () => {
    it("parses a free placement", () => {
      expect(sceneAssetInstancePlacementSchema.parse({ mode: "free" })).toEqual({
        mode: "free",
      });
    });

    it("parses a wall placement with local position", () => {
      const p = {
        mode: "wall" as const,
        wall: { wallId: "wall:south", localPositionMm: { x: 500, y: 1200, z: 0 } },
      };
      expect(sceneAssetInstancePlacementSchema.parse(p)).toEqual(p);
    });

    it("rejects an unknown mode", () => {
      expect(() =>
        sceneAssetInstancePlacementSchema.parse({ mode: "floating" }),
      ).toThrow();
    });

    it("rejects a wall attachment with an empty wallId", () => {
      expect(() =>
        sceneAssetInstancePlacementSchema.parse({
          mode: "wall",
          wall: { wallId: "", localPositionMm: { x: 0, y: 0, z: 0 } },
        }),
      ).toThrow();
    });

    it("does not require `wall` when mode='wall' at the parse layer — normalization catches it", () => {
      // Deliberately permissive at parse; `normalizeInstancePlacement`
      // drops back to free when the wall payload is missing.
      expect(() =>
        sceneAssetInstancePlacementSchema.parse({ mode: "wall" }),
      ).not.toThrow();
      expect(normalizeInstancePlacement({ mode: "wall" })).toEqual(DEFAULT_INSTANCE_PLACEMENT);
    });
  });

  describe("isWallAttached", () => {
    it("is true for a well-formed wall placement", () => {
      expect(
        isWallAttached({
          mode: "wall",
          wall: { wallId: "wall:south", localPositionMm: { x: 0, y: 0, z: 0 } },
        }),
      ).toBe(true);
    });

    it("is false for free / undefined / partial wall", () => {
      expect(isWallAttached(undefined)).toBe(false);
      expect(isWallAttached({ mode: "free" })).toBe(false);
      expect(isWallAttached({ mode: "wall" })).toBe(false);
    });
  });

  describe("normalizeInstancePlacement", () => {
    it("falls back to free when undefined", () => {
      expect(normalizeInstancePlacement(undefined)).toEqual({ mode: "free" });
    });

    it("preserves a valid wall placement", () => {
      const p = {
        mode: "wall" as const,
        wall: { wallId: "wall:south", localPositionMm: { x: 100, y: 0, z: 0 } },
      };
      expect(normalizeInstancePlacement(p)).toEqual(p);
    });

    it("drops back to free when mode='wall' but wall data is missing", () => {
      expect(normalizeInstancePlacement({ mode: "wall" })).toEqual({ mode: "free" });
    });
  });
});
