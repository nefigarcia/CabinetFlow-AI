import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import { deriveDefaultRoomArchitecture } from "../../architecture/legacy-adapter";
import {
  CABINET_WALL_PLACEMENT_KEY,
  DEFAULT_WALL_CABINET_ELEVATION_MM,
  computeCabinetWorldPosition,
  defaultBaseElevationMm,
  getCabinetWallPlacement,
  inferNearestWallForCabinet,
  isCabinetWallAttached,
  isFloorMountedCabinetType,
  isWallMountedCabinetType,
  resolveCabinetWorldPosition,
  withCabinetWallPlacement,
} from "../wall-placement";

const ROOM = { width: 4000, height: 2400, depth: 3000 };

function baseCabinet(overrides: Partial<Cabinet> = {}): Cabinet {
  return {
    id: "c1",
    roomId: "room_1",
    orgId: "org_1",
    type: "base",
    name: "Base 600",
    width: 600,
    height: 720,
    depth: 560,
    posX: 0,
    posY: 0,
    posZ: 0,
    parameters: {},
    materialId: null,
    parts: [],
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("cabinet wall placement — parameters bag storage", () => {
  it("reads null when parameters has no wallPlacement", () => {
    expect(getCabinetWallPlacement(baseCabinet())).toBeNull();
  });

  it("round-trips a valid wall placement through the parameters bag", () => {
    const merged = withCabinetWallPlacement(
      { doorCount: 2 },
      {
        wallId: "wall:south",
        offsetMm: 1200,
        baseElevationMm: 0,
        facing: "into-room",
      },
    );
    expect(merged[CABINET_WALL_PLACEMENT_KEY]).toEqual({
      wallId: "wall:south",
      offsetMm: 1200,
      baseElevationMm: 0,
      facing: "into-room",
    });
    expect(merged.doorCount).toBe(2);
    const cab = baseCabinet({ parameters: merged });
    expect(isCabinetWallAttached(cab)).toBe(true);
    expect(getCabinetWallPlacement(cab)?.offsetMm).toBe(1200);
  });

  it("returns null for a malformed persisted shape", () => {
    const cab = baseCabinet({
      parameters: { [CABINET_WALL_PLACEMENT_KEY]: { wallId: "", offsetMm: "0" } },
    });
    expect(getCabinetWallPlacement(cab)).toBeNull();
  });

  it("clears the placement when null is passed", () => {
    const merged = withCabinetWallPlacement(
      { [CABINET_WALL_PLACEMENT_KEY]: { wallId: "w", offsetMm: 0, baseElevationMm: 0, facing: "into-room" } },
      null,
    );
    expect(merged[CABINET_WALL_PLACEMENT_KEY]).toBeUndefined();
  });
});

describe("cabinet type policy", () => {
  it("floor-mounts base/tall/corner/drawer_base/sink_base/island", () => {
    for (const t of ["base", "tall", "corner", "drawer_base", "sink_base", "island"] as const) {
      expect(isFloorMountedCabinetType(t)).toBe(true);
      expect(defaultBaseElevationMm(t)).toBe(0);
    }
  });

  it("wall-mounts type='wall' at DEFAULT install height", () => {
    expect(isWallMountedCabinetType("wall")).toBe(true);
    expect(defaultBaseElevationMm("wall")).toBe(DEFAULT_WALL_CABINET_ELEVATION_MM);
  });
});

describe("computeCabinetWorldPosition — legacy walls", () => {
  const arch = deriveDefaultRoomArchitecture(ROOM);
  const south = arch.walls.find((w) => w.id === "wall:south")!;
  const east = arch.walls.find((w) => w.id === "wall:east")!;
  const north = arch.walls.find((w) => w.id === "wall:north")!;
  const west = arch.walls.find((w) => w.id === "wall:west")!;

  it("south wall: min corner at (offset, 0, 0)", () => {
    const p = computeCabinetWorldPosition({
      placement: { wallId: south.id, offsetMm: 1200, baseElevationMm: 0, facing: "into-room" },
      wall: south,
      widthMm: 600,
      depthMm: 560,
    });
    expect(p.posX).toBeCloseTo(1200, 6);
    expect(p.posY).toBeCloseTo(0, 6);
    expect(p.posZ).toBeCloseTo(0, 6);
  });

  it("east wall: min corner slides along z (tangent = +Z)", () => {
    const p = computeCabinetWorldPosition({
      placement: { wallId: east.id, offsetMm: 1500, baseElevationMm: 0, facing: "into-room" },
      wall: east,
      widthMm: 600,
      depthMm: 560,
    });
    expect(p.posX).toBeCloseTo(ROOM.width, 6);
    expect(p.posZ).toBeCloseTo(1500, 6);
  });

  it("north wall: tangent points -X, so offset moves posX from W toward 0", () => {
    const p = computeCabinetWorldPosition({
      placement: { wallId: north.id, offsetMm: 1000, baseElevationMm: 0, facing: "into-room" },
      wall: north,
      widthMm: 600,
      depthMm: 560,
    });
    expect(p.posX).toBeCloseTo(ROOM.width - 1000, 6);
    expect(p.posZ).toBeCloseTo(ROOM.depth, 6);
  });

  it("west wall: tangent points -Z, so offset moves posZ from D toward 0", () => {
    const p = computeCabinetWorldPosition({
      placement: { wallId: west.id, offsetMm: 1500, baseElevationMm: 0, facing: "into-room" },
      wall: west,
      widthMm: 600,
      depthMm: 560,
    });
    expect(p.posX).toBeCloseTo(0, 6);
    expect(p.posZ).toBeCloseTo(ROOM.depth - 1500, 6);
  });

  it("wall cabinet: posY = baseElevationMm (default 1400 mm)", () => {
    const p = computeCabinetWorldPosition({
      placement: { wallId: south.id, offsetMm: 0, baseElevationMm: 1400, facing: "into-room" },
      wall: south,
      widthMm: 600,
      depthMm: 320,
    });
    expect(p.posY).toBeCloseTo(1400, 6);
  });
});

describe("resolveCabinetWorldPosition — architecture lookup", () => {
  it("returns null for an unknown wallId", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(
      resolveCabinetWorldPosition({
        placement: { wallId: "does-not-exist", offsetMm: 0, baseElevationMm: 0, facing: "into-room" },
        architecture: arch,
        widthMm: 600,
        depthMm: 560,
      }),
    ).toBeNull();
  });
});

describe("inferNearestWallForCabinet", () => {
  it("infers the south wall for a cabinet placed at posZ≈0", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const guess = inferNearestWallForCabinet({
      cabinet: { posX: 1200, posY: 0, posZ: 40, width: 600, depth: 560 },
      architecture: arch,
    });
    expect(guess?.wallId).toBe("wall:south");
    expect(guess?.offsetMm).toBeCloseTo(1500, 0);
  });

  it("returns null when no wall is within tolerance", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const guess = inferNearestWallForCabinet({
      cabinet: { posX: 1500, posY: 0, posZ: 1500, width: 600, depth: 560 },
      architecture: arch,
      toleranceMm: 200,
    });
    expect(guess).toBeNull();
  });
});
