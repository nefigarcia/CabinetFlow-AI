import { describe, expect, it } from "vitest";
import {
  IDENTITY_SCALE,
  MAX_INSTANCE_SCALE,
  MIN_INSTANCE_SCALE,
  sceneAssetInstanceCreateSchema,
  sceneAssetInstanceUpdateSchema,
} from "../scene-asset-instance";

// Schema contract for scale. Enforces the same bounds the API PATCH
// route depends on, so a forged client payload can never persist an
// invalid multiplier.

describe("sceneAssetInstanceUpdateSchema — scale", () => {
  it("accepts identity scale", () => {
    const parsed = sceneAssetInstanceUpdateSchema.safeParse({
      scale: IDENTITY_SCALE,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid uniform scale below identity", () => {
    const parsed = sceneAssetInstanceUpdateSchema.safeParse({
      scale: { x: 0.5, y: 0.5, z: 0.5 },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts non-uniform per-axis scales", () => {
    const parsed = sceneAssetInstanceUpdateSchema.safeParse({
      scale: { x: 1.5, y: 0.8, z: 2 },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects zero on any axis", () => {
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({ scale: { x: 0, y: 1, z: 1 } })
        .success,
    ).toBe(false);
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({ scale: { x: 1, y: 0, z: 1 } })
        .success,
    ).toBe(false);
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({ scale: { x: 1, y: 1, z: 0 } })
        .success,
    ).toBe(false);
  });

  it("rejects negatives", () => {
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: -1, y: 1, z: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects NaN / Infinity", () => {
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: Number.NaN, y: 1, z: 1 },
      }).success,
    ).toBe(false);
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: Number.POSITIVE_INFINITY, y: 1, z: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects values below MIN_INSTANCE_SCALE", () => {
    const tooSmall = MIN_INSTANCE_SCALE / 2;
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: tooSmall, y: tooSmall, z: tooSmall },
      }).success,
    ).toBe(false);
  });

  it("rejects values above MAX_INSTANCE_SCALE", () => {
    const tooBig = MAX_INSTANCE_SCALE * 2;
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: tooBig, y: 1, z: 1 },
      }).success,
    ).toBe(false);
  });

  it("accepts a patch with only scale (partial update semantics preserved)", () => {
    expect(
      sceneAssetInstanceUpdateSchema.safeParse({
        scale: { x: 1.2, y: 1.2, z: 1.2 },
      }).success,
    ).toBe(true);
  });
});

describe("sceneAssetInstanceCreateSchema — scale is optional", () => {
  const minimalCreate = {
    assetDefinitionId: "def_abc",
    positionMm: { x: 0, y: 0, z: 0 },
  };

  it("accepts a create without scale (server stamps identity)", () => {
    expect(sceneAssetInstanceCreateSchema.safeParse(minimalCreate).success).toBe(
      true,
    );
  });

  it("accepts a create with valid scale", () => {
    expect(
      sceneAssetInstanceCreateSchema.safeParse({
        ...minimalCreate,
        scale: { x: 0.8, y: 0.8, z: 0.8 },
      }).success,
    ).toBe(true);
  });

  it("rejects a create with out-of-bounds scale", () => {
    expect(
      sceneAssetInstanceCreateSchema.safeParse({
        ...minimalCreate,
        scale: { x: 0, y: 1, z: 1 },
      }).success,
    ).toBe(false);
  });
});
