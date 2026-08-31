import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import type { SceneAssetInstance } from "../scene-asset-instance";
import {
  aabbIntersects,
  getSceneAssetAabb,
  getSceneAssetClearanceAabb,
  inflateAabb,
} from "../aabb";

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

function inst(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "i1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa",
    positionMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getSceneAssetAabb", () => {
  it("at origin with no rotation, produces bottom-center-anchored box", () => {
    const a = getSceneAssetAabb(inst(), def());
    expect(a.min).toEqual({ x: -1000, y: 0, z: -500 });
    expect(a.max).toEqual({ x: 1000, y: 800, z: 500 });
  });

  it("translates by positionMm", () => {
    const a = getSceneAssetAabb(inst({ positionMm: { x: 2400, y: 0, z: 3000 } }), def());
    expect(a.min).toEqual({ x: 1400, y: 0, z: 2500 });
    expect(a.max).toEqual({ x: 3400, y: 800, z: 3500 });
  });

  it("Y=90° rotation swaps width and depth into world X/Z", () => {
    const a = getSceneAssetAabb(inst({ rotationDeg: { x: 0, y: 90, z: 0 } }), def());
    // Width 2000 (halfW 1000) becomes Z extent; Depth 1000 (halfD 500) becomes X extent.
    expect(a.min.x).toBeCloseTo(-500, 6);
    expect(a.max.x).toBeCloseTo(500, 6);
    expect(a.min.z).toBeCloseTo(-1000, 6);
    expect(a.max.z).toBeCloseTo(1000, 6);
    // Height (Y) unaffected by pure Y rotation.
    expect(a.min.y).toBe(0);
    expect(a.max.y).toBe(800);
  });

  it("Y=45° rotation increases both X and Z extents (diagonal footprint)", () => {
    const a = getSceneAssetAabb(inst({ rotationDeg: { x: 0, y: 45, z: 0 } }), def());
    // Rotated footprint corners project onto both X and Z with combined
    // half-diagonals. Expected: (1000 * cos + 500 * sin) = ~707 + ~354 = ~1061
    expect(a.max.x).toBeCloseTo(1000 * Math.cos(Math.PI / 4) + 500 * Math.sin(Math.PI / 4), 5);
  });

  it("X rotation lifts back-bottom corners and tilts top corners", () => {
    const a = getSceneAssetAabb(inst({ rotationDeg: { x: 90, y: 0, z: 0 } }), def());
    // Y and Z swap: original H=800 becomes Z extent; D=1000 becomes Y extent
    expect(a.max.z).toBeCloseTo(800, 6);
    expect(a.max.y).toBeCloseTo(500, 6);
  });

  it("does not mutate input instance or definition", () => {
    const instance = inst({ positionMm: { x: 100, y: 0, z: 200 }, rotationDeg: { x: 0, y: 45, z: 0 } });
    const definition = def();
    const snapshot = JSON.stringify({ instance, definition });
    getSceneAssetAabb(instance, definition);
    expect(JSON.stringify({ instance, definition })).toBe(snapshot);
  });
});

describe("aabbIntersects", () => {
  it("overlapping boxes intersect", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const b = { min: { x: 50, y: 50, z: 50 }, max: { x: 150, y: 150, z: 150 } };
    expect(aabbIntersects(a, b)).toBe(true);
  });

  it("touching-face boxes do NOT intersect (strict inequality)", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const b = { min: { x: 100, y: 0, z: 0 }, max: { x: 200, y: 100, z: 100 } };
    expect(aabbIntersects(a, b)).toBe(false);
  });

  it("fully separated boxes do not intersect", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const b = { min: { x: 200, y: 0, z: 0 }, max: { x: 300, y: 100, z: 100 } };
    expect(aabbIntersects(a, b)).toBe(false);
  });

  it("nested boxes intersect", () => {
    const outer = { min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 1000, z: 1000 } };
    const inner = { min: { x: 400, y: 400, z: 400 }, max: { x: 600, y: 600, z: 600 } };
    expect(aabbIntersects(outer, inner)).toBe(true);
  });

  it("is symmetric", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const b = { min: { x: 50, y: 50, z: 50 }, max: { x: 150, y: 150, z: 150 } };
    expect(aabbIntersects(a, b)).toBe(aabbIntersects(b, a));
  });
});

describe("getSceneAssetClearanceAabb", () => {
  const fridgeDef: SceneAssetDefinition = {
    id: "fridge",
    version: 1,
    name: "Refrigerator",
    category: "appliance",
    dimensionsMm: { widthMm: 900, heightMm: 1800, depthMm: 700 },
    collision: {
      enabled: true,
      clearanceFrontMm: 900,
      clearanceBackMm: 50,
      clearanceLeftMm: 25,
      clearanceRightMm: 25,
      clearanceTopMm: 25,
    },
  };

  it("expands the plain AABB by clearance amounts in each local direction", () => {
    const a = getSceneAssetClearanceAabb(inst({ positionMm: { x: 0, y: 0, z: 0 } }), fridgeDef);
    // halfW=450 + 25 left/right = 475; halfD=350 + back=50 back, +front=900 front
    expect(a.min.x).toBeCloseTo(-475, 5);
    expect(a.max.x).toBeCloseTo(475, 5);
    expect(a.min.z).toBeCloseTo(-400, 5); // -350 - 50 back
    expect(a.max.z).toBeCloseTo(1250, 5); // +350 + 900 front
    expect(a.max.y).toBeCloseTo(1825, 5);
  });

  it("rotates the clearance envelope with the asset (front clearance follows rotation)", () => {
    const a = getSceneAssetClearanceAabb(
      inst({ rotationDeg: { x: 0, y: 90, z: 0 } }),
      fridgeDef,
    );
    // Three.js right-handed convention: Y=+90° rotates local +Z → world +X.
    // Front clearance (originally +Z 1250) becomes +X.
    expect(a.max.x).toBeCloseTo(1250, 5);
  });

  it("returns plain AABB when collision is disabled", () => {
    const disabledDef = {
      ...fridgeDef,
      collision: { enabled: false, clearanceFrontMm: 5000 },
    };
    const plain = getSceneAssetAabb(inst(), fridgeDef);
    const clearance = getSceneAssetClearanceAabb(inst(), disabledDef);
    expect(clearance).toEqual(plain);
  });

  it("returns plain AABB when no collision metadata", () => {
    const noMetaDef: SceneAssetDefinition = {
      id: "x",
      version: 1,
      name: "X",
      category: "furniture",
      dimensionsMm: { widthMm: 100, heightMm: 100, depthMm: 100 },
    };
    const plain = getSceneAssetAabb(inst(), noMetaDef);
    const clearance = getSceneAssetClearanceAabb(inst(), noMetaDef);
    expect(clearance).toEqual(plain);
  });
});

describe("inflateAabb", () => {
  it("expands all sides by mm", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const inflated = inflateAabb(a, 10);
    expect(inflated.min).toEqual({ x: -10, y: -10, z: -10 });
    expect(inflated.max).toEqual({ x: 110, y: 110, z: 110 });
  });

  it("negative inflation shrinks", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const shrunk = inflateAabb(a, -10);
    expect(shrunk.min).toEqual({ x: 10, y: 10, z: 10 });
    expect(shrunk.max).toEqual({ x: 90, y: 90, z: 90 });
  });
});
