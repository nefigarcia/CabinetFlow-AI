import { describe, expect, it } from "vitest";
import type { Room } from "../../../types/project";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import { getDefaultSceneAssetPlacement } from "../default-placement";

function makeRoom(overrides: Partial<Pick<Room, "width" | "height" | "depth">> = {}): Room {
  return {
    id: "room_1",
    projectId: "proj_1",
    orgId: "org_1",
    name: "Room",
    width: 4800,
    height: 2400,
    depth: 3600,
    metadata: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function def(
  overrides: Partial<SceneAssetDefinition> = {},
): SceneAssetDefinition {
  return {
    id: "sofa",
    version: 1,
    name: "Sofa",
    category: "furniture",
    dimensionsMm: { widthMm: 2100, heightMm: 850, depthMm: 950 },
    ...overrides,
  };
}

describe("getDefaultSceneAssetPlacement", () => {
  it("centers a floor-mounted asset on the room floor (X=W/2, Y=0, Z=D/2)", () => {
    const result = getDefaultSceneAssetPlacement({
      room: makeRoom({ width: 4800, depth: 3600 }),
      definition: def(),
    });
    expect(result.transform.positionMm).toEqual({ x: 2400, y: 0, z: 1800 });
  });

  it("uses identity rotation by default", () => {
    const result = getDefaultSceneAssetPlacement({
      room: makeRoom(),
      definition: def(),
    });
    expect(result.transform.rotationDeg).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("Y is always 0 for floor-mounted assets (bottom-center anchor)", () => {
    const result = getDefaultSceneAssetPlacement({
      room: makeRoom(),
      definition: def({ placement: { floorMounted: true } }),
    });
    expect(result.transform.positionMm.y).toBe(0);
  });

  it("returns coordinates in millimeters (no meter conversion)", () => {
    const result = getDefaultSceneAssetPlacement({
      room: makeRoom({ width: 4800, depth: 3600 }),
      definition: def(),
    });
    // 4800 mm room / 2 = 2400 mm, not 2.4 (meters).
    expect(result.transform.positionMm.x).toBe(2400);
    expect(result.transform.positionMm.z).toBe(1800);
  });

  it("returns origin when room is null (caller is expected to guard placement)", () => {
    const result = getDefaultSceneAssetPlacement({
      room: null,
      definition: def(),
    });
    expect(result.transform.positionMm).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.warnings).toEqual([]);
  });

  it("does not mutate the definition", () => {
    const d = def();
    const snap = JSON.stringify(d);
    getDefaultSceneAssetPlacement({ room: makeRoom(), definition: d });
    expect(JSON.stringify(d)).toBe(snap);
  });

  it("does not mutate the room", () => {
    const r = makeRoom();
    const snap = JSON.stringify(r);
    getDefaultSceneAssetPlacement({ room: r, definition: def() });
    expect(JSON.stringify(r)).toBe(snap);
  });

  describe("oversized-asset warnings", () => {
    it("warns when the asset is wider than the room", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom({ width: 1000 }),
        definition: def({ dimensionsMm: { widthMm: 2400, heightMm: 800, depthMm: 800 } }),
      });
      expect(result.warnings.map((w) => w.code)).toContain("ASSET_WIDER_THAN_ROOM");
    });

    it("warns when the asset is deeper than the room", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom({ depth: 500 }),
        definition: def({ dimensionsMm: { widthMm: 800, heightMm: 800, depthMm: 2000 } }),
      });
      expect(result.warnings.map((w) => w.code)).toContain("ASSET_DEEPER_THAN_ROOM");
    });

    it("warns when the asset is taller than the room", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom({ height: 500 }),
        definition: def({ dimensionsMm: { widthMm: 800, heightMm: 2400, depthMm: 800 } }),
      });
      expect(result.warnings.map((w) => w.code)).toContain("ASSET_TALLER_THAN_ROOM");
    });

    it("still returns a centered transform even when oversized (permissive, not blocking)", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom({ width: 500, depth: 500, height: 500 }),
        definition: def({ dimensionsMm: { widthMm: 3000, heightMm: 3000, depthMm: 3000 } }),
      });
      expect(result.transform.positionMm).toEqual({ x: 250, y: 0, z: 250 });
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    });

    it("emits no warnings when the asset fits comfortably", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom({ width: 6000, height: 3000, depth: 6000 }),
        definition: def({ dimensionsMm: { widthMm: 900, heightMm: 900, depthMm: 900 } }),
      });
      expect(result.warnings).toEqual([]);
    });
  });

  describe("deferred placement modes", () => {
    it("warns WALL_MOUNT_NOT_IMPLEMENTED for wall-only assets", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom(),
        definition: def({
          placement: { wallMounted: true, floorMounted: false },
        }),
      });
      expect(result.warnings.map((w) => w.code)).toContain("WALL_MOUNT_NOT_IMPLEMENTED");
    });

    it("warns CEILING_MOUNT_NOT_IMPLEMENTED for ceiling-only assets", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom(),
        definition: def({
          placement: { ceilingMounted: true, floorMounted: false },
        }),
      });
      expect(result.warnings.map((w) => w.code)).toContain("CEILING_MOUNT_NOT_IMPLEMENTED");
    });

    it("warns COUNTERTOP_MOUNT_NOT_IMPLEMENTED for countertop-only assets", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom(),
        definition: def({
          placement: { countertopMounted: true, floorMounted: false },
        }),
      });
      expect(result.warnings.map((w) => w.code)).toContain(
        "COUNTERTOP_MOUNT_NOT_IMPLEMENTED",
      );
    });

    it("does NOT warn when the asset can also be floor-mounted", () => {
      const result = getDefaultSceneAssetPlacement({
        room: makeRoom(),
        definition: def({
          placement: { floorMounted: true, wallMounted: true },
        }),
      });
      expect(result.warnings.map((w) => w.code)).not.toContain("WALL_MOUNT_NOT_IMPLEMENTED");
    });
  });
});
