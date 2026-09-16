import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import type { SceneAssetInstance, Vec3 } from "../scene-asset-instance";
import {
  aabbIntersects,
  getSceneAssetAabb,
  getSceneAssetClearanceAabb,
} from "../aabb";

// Scale-aware collision. The pure `getSceneAssetAabb` /
// `getSceneAssetClearanceAabb` MUST respect the instance's per-axis
// scale — otherwise a resized fridge would collide as if it were still
// its catalog size, silently violating clearance rules or leaking
// overlap into another cabinet run.

function def(overrides: Partial<SceneAssetDefinition> = {}): SceneAssetDefinition {
  return {
    id: "fridge",
    version: 1,
    name: "Fridge",
    category: "appliance",
    dimensionsMm: { widthMm: 900, heightMm: 1800, depthMm: 700 },
    ...overrides,
  };
}

function inst(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "i1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "fridge",
    positionMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getSceneAssetAabb — respects instance scale", () => {
  it("uniform 0.5 scale halves each axis of the bounding volume", () => {
    const a = getSceneAssetAabb(
      inst({ scale: { x: 0.5, y: 0.5, z: 0.5 } }),
      def(),
    );
    // Width goes from 900mm to 450mm → halfW = 225mm around x=0.
    expect(a.min.x).toBeCloseTo(-225);
    expect(a.max.x).toBeCloseTo(225);
    // Bottom-center anchor: y stays anchored at 0, top is 1800 * 0.5.
    expect(a.min.y).toBeCloseTo(0);
    expect(a.max.y).toBeCloseTo(900);
    // Depth 700 * 0.5 → halfD 175.
    expect(a.min.z).toBeCloseTo(-175);
    expect(a.max.z).toBeCloseTo(175);
  });

  it("non-uniform scale stretches only the intended axis", () => {
    const a = getSceneAssetAabb(
      inst({ scale: { x: 2, y: 1, z: 1 } }),
      def(),
    );
    // width doubles: 900 → 1800; halves half-extent 900.
    expect(a.max.x - a.min.x).toBeCloseTo(1800);
    // height untouched.
    expect(a.max.y - a.min.y).toBeCloseTo(1800);
    // depth untouched.
    expect(a.max.z - a.min.z).toBeCloseTo(700);
  });

  it("legacy instance without a scale field defaults to identity", () => {
    // Simulates a row serialized before scale was editable.
    const legacy: {
      positionMm: Vec3;
      rotationDeg: Vec3;
    } = {
      positionMm: { x: 0, y: 0, z: 0 },
      rotationDeg: { x: 0, y: 0, z: 0 },
    };
    const a = getSceneAssetAabb(legacy, def());
    // Full catalog envelope.
    expect(a.max.x - a.min.x).toBeCloseTo(900);
    expect(a.max.y - a.min.y).toBeCloseTo(1800);
    expect(a.max.z - a.min.z).toBeCloseTo(700);
  });
});

describe("aabbIntersects with scaled instances", () => {
  it("two identical fridges at 0.5 scale, 500mm apart on X, do NOT overlap", () => {
    const a = getSceneAssetAabb(
      inst({ scale: { x: 0.5, y: 0.5, z: 0.5 } }),
      def(),
    );
    const b = getSceneAssetAabb(
      inst({
        positionMm: { x: 500, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      }),
      def(),
    );
    expect(aabbIntersects(a, b)).toBe(false);
  });

  it("full-scale fridge and half-scale fridge, 300mm apart on X, DO overlap", () => {
    const a = getSceneAssetAabb(inst(), def());
    const b = getSceneAssetAabb(
      inst({
        positionMm: { x: 300, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      }),
      def(),
    );
    expect(aabbIntersects(a, b)).toBe(true);
  });

  it("two different definitions can have different scales", () => {
    const sofa = def({
      id: "sofa",
      name: "Sofa",
      category: "furniture",
      dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 1000 },
    });
    const upscaledSofa = getSceneAssetAabb(
      inst({ scale: { x: 1.5, y: 1, z: 1 } }),
      sofa,
    );
    const identityFridge = getSceneAssetAabb(inst(), def());
    // Sanity: the returned volumes reflect independent scale states.
    expect(upscaledSofa.max.x - upscaledSofa.min.x).toBeCloseTo(3000);
    expect(identityFridge.max.x - identityFridge.min.x).toBeCloseTo(900);
  });
});

describe("getSceneAssetClearanceAabb — respects scale on envelope, not on clearance", () => {
  const withClearance = def({
    collision: { enabled: true, clearanceFrontMm: 900 },
  });

  it("scaling the fridge scales the envelope but keeps clearance authored value", () => {
    const halfScale = getSceneAssetClearanceAabb(
      inst({ scale: { x: 0.5, y: 0.5, z: 0.5 } }),
      withClearance,
    );
    // Envelope: 900 * 0.5 = 450 wide, 700 * 0.5 = 350 deep.
    // Front clearance stays at authored 900mm (safety spec is per-manufacturer,
    // not per-user-visual-scale — see aabb.ts docstring).
    // Depth extent: halfD (175) + clearanceFrontMm (900) = 1075 on the front
    // side; +Z front direction after identity rotation.
    expect(halfScale.max.z).toBeCloseTo(175 + 900);
    // Back side unchanged (clearanceBackMm defaults to 0).
    expect(halfScale.min.z).toBeCloseTo(-175);
  });
});
