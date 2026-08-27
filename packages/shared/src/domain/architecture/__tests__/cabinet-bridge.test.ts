import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import type { SceneAssetDefinition } from "../../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../../sceneAssets/scene-asset-instance";
import {
  detectCabinetsVsOpenings,
  detectSceneAssetVsCabinet,
  getCabinetAabb,
} from "../cabinet-bridge";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";

const ROOM = { width: 4800, height: 2400, depth: 3600 };

function cab(overrides: Partial<Cabinet> = {}): Cabinet {
  return {
    id: "c1",
    roomId: "room_1",
    orgId: "org_1",
    type: "base",
    name: "Base 24",
    width: 600,
    height: 870,
    depth: 600,
    posX: 100,
    posY: 0,
    posZ: 100,
    parameters: {},
    materialId: null,
    parts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function inst(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "i1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa",
    positionMm: { x: 2000, y: 0, z: 2000 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const SOFA_DEF: SceneAssetDefinition = {
  id: "sofa",
  version: 1,
  name: "Sofa",
  category: "furniture",
  dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 1000 },
};

describe("getCabinetAabb", () => {
  it("returns min = position, max = position + dimensions (corner-anchored)", () => {
    const c = cab({ posX: 500, posY: 0, posZ: 200, width: 600, height: 800, depth: 400 });
    expect(getCabinetAabb(c)).toEqual({
      min: { x: 500, y: 0, z: 200 },
      max: { x: 1100, y: 800, z: 600 },
    });
  });
});

describe("detectSceneAssetVsCabinet", () => {
  it("clean placement returns []", () => {
    expect(
      detectSceneAssetVsCabinet({
        instance: inst({ positionMm: { x: 3500, y: 0, z: 3000 } }),
        definition: SOFA_DEF,
        cabinets: [cab({ posX: 100, posZ: 100 })],
      }),
    ).toEqual([]);
  });

  it("emits SCENE_ASSET_OVERLAPS_CABINET on AABB overlap", () => {
    const issues = detectSceneAssetVsCabinet({
      instance: inst({ positionMm: { x: 400, y: 0, z: 400 } }),
      definition: SOFA_DEF,
      cabinets: [cab({ posX: 100, posZ: 100, width: 600, depth: 600 })],
    });
    const overlap = issues.find((i) => i.code === "SCENE_ASSET_OVERLAPS_CABINET");
    expect(overlap).toBeDefined();
    expect(overlap?.cabinetId).toBe("c1");
    expect(overlap?.sceneAssetInstanceId).toBe("i1");
    expect(overlap?.source).toBe("cabinet");
  });

  it("reports one warning per overlapping cabinet", () => {
    const issues = detectSceneAssetVsCabinet({
      instance: inst({ positionMm: { x: 500, y: 0, z: 500 } }),
      definition: SOFA_DEF,
      cabinets: [
        cab({ id: "a", posX: 0, posZ: 0 }),
        cab({ id: "b", posX: 600, posZ: 0 }),
        cab({ id: "c", posX: 0, posZ: 4000 }),
      ],
    });
    const overlapIds = issues
      .filter((i) => i.code === "SCENE_ASSET_OVERLAPS_CABINET")
      .map((i) => i.cabinetId)
      .sort();
    expect(overlapIds).toEqual(["a", "b"]);
  });
});

describe("detectCabinetsVsOpenings", () => {
  it("clean rectangular room (no openings) returns []", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(
      detectCabinetsVsOpenings({ cabinets: [cab()], architecture: arch }),
    ).toEqual([]);
  });

  it("cabinet placed in front of a door emits CABINET_OVERLAPS_OPENING", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    // South wall door at offset 1000, width 900. In world coords that's
    // x=1000..1900 along z=0. Place a base cabinet right at that spot.
    arch.walls[0]!.openings.push({
      id: "d1",
      type: "door",
      offsetMm: 1000,
      widthMm: 900,
      heightMm: 2100,
    });
    const issues = detectCabinetsVsOpenings({
      cabinets: [cab({ posX: 1100, posZ: 0, width: 600, depth: 600 })],
      architecture: arch,
    });
    const overlap = issues.find((i) => i.code === "CABINET_OVERLAPS_OPENING");
    expect(overlap).toBeDefined();
    expect(overlap?.openingId).toBe("d1");
    expect(overlap?.wallId).toBe("wall:south");
  });

  it("every emitted issue is source='cabinet'", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    arch.walls[0]!.openings.push({
      id: "d1",
      type: "door",
      offsetMm: 1000,
      widthMm: 900,
      heightMm: 2100,
    });
    const issues = detectCabinetsVsOpenings({
      cabinets: [cab({ posX: 1100, posZ: 0 })],
      architecture: arch,
    });
    for (const i of issues) expect(i.source).toBe("cabinet");
  });
});
