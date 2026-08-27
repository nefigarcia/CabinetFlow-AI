import { describe, expect, it } from "vitest";
import type { SceneAssetInstance } from "../scene-asset-instance";
import {
  DEFAULT_DUPLICATE_OFFSET_MM_X,
  duplicateSceneAssetInstance,
} from "../duplicate-instance";

function makeInstance(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "src_1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa-modern-01",
    positionMm: { x: 100, y: 0, z: 200 },
    rotationDeg: { x: 0, y: 45, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    materialOverrides: { upholstery: "fabric-cream" },
    ...overrides,
  };
}

describe("duplicateSceneAssetInstance", () => {
  it("returns a CREATE INPUT (no id, no timestamps, no tenancy — server owns those)", () => {
    const src = makeInstance();
    const dup = duplicateSceneAssetInstance(src);
    // Compile-time shape enforcement is via the return type; verify runtime
    // shape too so accidental extra fields would fail the test.
    expect(dup).not.toHaveProperty("id");
    expect(dup).not.toHaveProperty("orgId");
    expect(dup).not.toHaveProperty("roomId");
    expect(dup).not.toHaveProperty("createdAt");
    expect(dup).not.toHaveProperty("updatedAt");
    expect(dup).not.toHaveProperty("scale"); // MVP: identity only, server default
  });

  it("preserves the catalog reference (assetDefinitionId)", () => {
    const src = makeInstance();
    const dup = duplicateSceneAssetInstance(src);
    expect(dup.assetDefinitionId).toBe(src.assetDefinitionId);
  });

  it("shifts X by exactly the default 200 mm", () => {
    const src = makeInstance({ positionMm: { x: 100, y: 0, z: 200 } });
    const dup = duplicateSceneAssetInstance(src);
    expect(dup.positionMm.x).toBe(100 + DEFAULT_DUPLICATE_OFFSET_MM_X);
    expect(DEFAULT_DUPLICATE_OFFSET_MM_X).toBe(200);
  });

  it("respects a custom X offset (including 0 and negatives)", () => {
    const src = makeInstance({ positionMm: { x: 100, y: 0, z: 200 } });
    expect(duplicateSceneAssetInstance(src, { offsetMmX: 0 }).positionMm.x).toBe(100);
    expect(duplicateSceneAssetInstance(src, { offsetMmX: -500 }).positionMm.x).toBe(-400);
  });

  it("does not shift Y or Z", () => {
    const src = makeInstance({ positionMm: { x: 100, y: 300, z: 200 } });
    const dup = duplicateSceneAssetInstance(src);
    expect(dup.positionMm.y).toBe(300);
    expect(dup.positionMm.z).toBe(200);
  });

  it("preserves rotation, visibility, material overrides", () => {
    const src = makeInstance({
      rotationDeg: { x: 10, y: 20, z: 30 },
      visible: false,
      materialOverrides: { upholstery: "fabric-cream", frame: "wood-oak" },
    });
    const dup = duplicateSceneAssetInstance(src);
    expect(dup.rotationDeg).toEqual({ x: 10, y: 20, z: 30 });
    expect(dup.visible).toBe(false);
    expect(dup.materialOverrides).toEqual({ upholstery: "fabric-cream", frame: "wood-oak" });
  });

  it("handles missing materialOverrides", () => {
    const src = makeInstance({ materialOverrides: undefined });
    const dup = duplicateSceneAssetInstance(src);
    expect(dup.materialOverrides).toBeUndefined();
  });

  it("does NOT mutate the source instance", () => {
    const src = makeInstance();
    const snapshot = JSON.stringify(src);
    duplicateSceneAssetInstance(src);
    expect(JSON.stringify(src)).toBe(snapshot);
  });

  it("shallow-clones rotation/overrides so later mutation doesn't leak back", () => {
    const src = makeInstance();
    const dup = duplicateSceneAssetInstance(src);
    dup.rotationDeg!.y = 999;
    if (dup.materialOverrides) dup.materialOverrides.upholstery = "changed";
    expect(src.rotationDeg.y).toBe(45);
    expect(src.materialOverrides?.upholstery).toBe("fabric-cream");
  });
});
