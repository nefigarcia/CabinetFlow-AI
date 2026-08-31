import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../../sceneAssets/scene-asset-instance";
import type { RoomArchitecture } from "../types";
import {
  getRoomFloorFootprint,
  validateAssetAgainstArchitecture,
} from "../spatial-bridge";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";

const ROOM = { width: 4000, height: 2400, depth: 3000 };

function sofa(): SceneAssetDefinition {
  return {
    id: "sofa",
    version: 1,
    name: "Sofa",
    category: "furniture",
    dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 1000 },
  };
}

function inst(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "i1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa",
    positionMm: { x: 2000, y: 0, z: 1500 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getRoomFloorFootprint", () => {
  it("returns rectangular bounds of legacy walls", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const fp = getRoomFloorFootprint(arch);
    expect(fp).toEqual({
      min: { x: 0, z: 0 },
      max: { x: 4000, z: 3000 },
    });
  });

  it("returns null for empty walls", () => {
    const arch: RoomArchitecture = { schemaVersion: "1.0", walls: [] };
    expect(getRoomFloorFootprint(arch)).toBeNull();
  });
});

describe("validateAssetAgainstArchitecture", () => {
  it("clean placement in room center returns []", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const issues = validateAssetAgainstArchitecture({
      instance: inst({ positionMm: { x: 2000, y: 0, z: 1500 } }),
      definition: sofa(),
      architecture: arch,
    });
    expect(issues).toEqual([]);
  });

  it("emits ASSET_INTERSECTS_WALL when the asset overlaps a wall centerline", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    // Push the sofa deep into the south wall — its center at z=0 puts
    // half of its depth into z<0, past the wall face.
    const issues = validateAssetAgainstArchitecture({
      instance: inst({ positionMm: { x: 2000, y: 0, z: 0 } }),
      definition: sofa(),
      architecture: arch,
    });
    expect(issues.some((i) => i.code === "ASSET_INTERSECTS_WALL")).toBe(true);
    const wallIssue = issues.find((i) => i.code === "ASSET_INTERSECTS_WALL");
    expect(wallIssue?.wallId).toBe("wall:south");
    expect(wallIssue?.severity).toBe("warning");
    expect(wallIssue?.source).toBe("architecture");
  });

  it("emits ASSET_OUTSIDE_ROOM_FOOTPRINT when asset extends past the polygon", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const issues = validateAssetAgainstArchitecture({
      instance: inst({ positionMm: { x: -500, y: 0, z: 1500 } }),
      definition: sofa(),
      architecture: arch,
    });
    expect(issues.some((i) => i.code === "ASSET_OUTSIDE_ROOM_FOOTPRINT")).toBe(true);
  });

  it("only reports one wall intersection per wall (no duplicate segments)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    arch.walls[0]!.openings.push({
      id: "d1",
      type: "door",
      offsetMm: 1000,
      widthMm: 900,
      heightMm: 2100,
    });
    // Overlap wall on both sides of the door.
    const issues = validateAssetAgainstArchitecture({
      instance: inst({ positionMm: { x: 500, y: 0, z: 0 } }),
      definition: sofa(),
      architecture: arch,
    });
    const wallIssues = issues.filter(
      (i) => i.code === "ASSET_INTERSECTS_WALL" && i.wallId === "wall:south",
    );
    expect(wallIssues).toHaveLength(1);
  });

  it("every emitted issue is source='architecture' + severity='warning'", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const issues = validateAssetAgainstArchitecture({
      instance: inst({ positionMm: { x: -500, y: 0, z: 0 } }),
      definition: sofa(),
      architecture: arch,
    });
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.source).toBe("architecture");
      expect(i.severity).toBe("warning");
    }
  });
});
