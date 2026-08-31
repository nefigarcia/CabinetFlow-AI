import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import { deriveDefaultRoomArchitecture } from "../../architecture/legacy-adapter";
import {
  buildCabinetRuns,
  detectRunGaps,
  detectRunOverlaps,
  getApplianceExtentsOnWall,
  getCabinetRunExtent,
  getFreeCabinets,
  getRemainingWallSpace,
  getRunCabinetsWidthSum,
  sortRunItems,
} from "../cabinet-run";
import { withCabinetWallPlacement } from "../wall-placement";

const ROOM = { width: 4000, height: 2400, depth: 3000 };
const arch = deriveDefaultRoomArchitecture(ROOM);
const south = arch.walls.find((w) => w.id === "wall:south")!;

function cab(
  id: string,
  overrides: Partial<Cabinet> & { offsetMm?: number; wallId?: string } = {},
): Cabinet {
  const wallId = overrides.wallId ?? south.id;
  const offsetMm = overrides.offsetMm;
  const base: Cabinet = {
    id,
    roomId: "room_1",
    orgId: "org_1",
    type: "base",
    name: id,
    width: 600,
    height: 720,
    depth: 560,
    posX: 0,
    posY: 0,
    posZ: 0,
    parameters:
      offsetMm !== undefined
        ? withCabinetWallPlacement(
            {},
            { wallId, offsetMm, baseElevationMm: 0, facing: "into-room" },
          )
        : {},
    materialId: null,
    parts: [],
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
    // Re-apply parameters after spread so `overrides.parameters` merges cleanly.
    ...(overrides.parameters ? { parameters: overrides.parameters } : {}),
  };
  return base;
}

describe("buildCabinetRuns", () => {
  it("buckets attached cabinets by wall, drops free", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 600 }), cab("free")],
      walls: arch.walls,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.wallId).toBe("wall:south");
    expect(runs[0]!.items.map((i) => i.cabinetId)).toEqual(["a", "b"]);
  });

  it("sorts items by offset ascending (ties break by id)", () => {
    const runs = buildCabinetRuns({
      cabinets: [
        cab("c", { offsetMm: 1200 }),
        cab("a", { offsetMm: 0 }),
        cab("b", { offsetMm: 600 }),
      ],
      walls: arch.walls,
    });
    expect(runs[0]!.items.map((i) => i.cabinetId)).toEqual(["a", "b", "c"]);
  });
});

describe("run extent + width sum", () => {
  it("extent includes any interior gaps; sum does not", () => {
    const items = sortRunItems([
      { cabinetId: "a", cabinet: cab("a"), placement: { wallId: "w", offsetMm: 0, baseElevationMm: 0, facing: "into-room" }, rightEdgeMm: 600 },
      { cabinetId: "b", cabinet: cab("b"), placement: { wallId: "w", offsetMm: 1000, baseElevationMm: 0, facing: "into-room" }, rightEdgeMm: 1600 },
    ]);
    const run = { wallId: "w", wall: south, items };
    expect(getCabinetRunExtent(run)).toEqual({ startMm: 0, endMm: 1600, totalWidthMm: 1600 });
    expect(getRunCabinetsWidthSum(run)).toBe(1200);
  });
});

describe("gap detection", () => {
  it("adjacent chain → exact gap", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 600 })],
      walls: arch.walls,
    });
    const gaps = detectRunGaps({ run: runs[0]! });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.kind).toBe("exact");
  });

  it("< 100 mm gap → filler", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 660 })],
      walls: arch.walls,
    });
    expect(detectRunGaps({ run: runs[0]! })[0]!.kind).toBe("filler");
  });

  it("large gap without reason → unassigned", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 1500 })],
      walls: arch.walls,
    });
    expect(detectRunGaps({ run: runs[0]! })[0]!.kind).toBe("unassigned");
  });

  it("gap covered by a door opening → intentional", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 1500 })],
      walls: arch.walls,
    });
    const gaps = detectRunGaps({
      run: runs[0]!,
      openings: [
        { id: "d1", type: "door", offsetMm: 600, widthMm: 900, heightMm: 2100 },
      ],
    });
    expect(gaps[0]!.kind).toBe("intentional");
    expect(gaps[0]!.reason?.kind).toBe("opening");
  });

  it("gap covered by an appliance extent → intentional (scene-asset)", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 1500 })],
      walls: arch.walls,
    });
    const gaps = detectRunGaps({
      run: runs[0]!,
      applianceExtents: [{ id: "fridge", startMm: 600, endMm: 1500, label: "Refrigerator" }],
    });
    expect(gaps[0]!.kind).toBe("intentional");
    expect(gaps[0]!.reason?.kind).toBe("scene-asset");
  });
});

describe("overlap detection", () => {
  it("returns one entry per overlapping pair", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 }), cab("b", { offsetMm: 400 })],
      walls: arch.walls,
    });
    const ov = detectRunOverlaps(runs[0]!);
    expect(ov).toHaveLength(1);
    expect(ov[0]!.widthMm).toBeCloseTo(200, 6);
  });
});

describe("remaining wall space", () => {
  it("no cabinets → whole wall remaining", () => {
    const remaining = getRemainingWallSpace({ wall: south });
    expect(remaining.remainingMm).toBeCloseTo(ROOM.width, 6);
  });

  it("subtracts openings + cabinets + appliances", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", { offsetMm: 0 })],
      walls: arch.walls,
    });
    const remaining = getRemainingWallSpace({
      wall: south,
      run: runs[0]!,
      openings: [{ id: "d1", type: "door", offsetMm: 2000, widthMm: 900, heightMm: 2100 }],
      applianceExtents: [{ startMm: 3000, endMm: 3900 }],
    });
    // 4000 - 600 (cabinet) - 900 (door) - 900 (appliance) = 1600
    expect(remaining.remainingMm).toBeCloseTo(1600, 6);
  });
});

describe("getFreeCabinets", () => {
  it("returns cabinets with no wallPlacement", () => {
    const free = getFreeCabinets([cab("a", { offsetMm: 0 }), cab("free")]);
    expect(free.map((c) => c.id)).toEqual(["free"]);
  });
});

describe("getApplianceExtentsOnWall", () => {
  it("returns extents only for scene assets attached to the given wall", () => {
    const list = getApplianceExtentsOnWall({
      wall: south,
      sceneAssets: [
        {
          instance: {
            id: "i1",
            orgId: "o",
            roomId: "r",
            assetDefinitionId: "fridge",
            positionMm: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            visible: true,
            placement: {
              mode: "wall",
              wall: { wallId: south.id, localPositionMm: { x: 1000, y: 0, z: 0 } },
            },
            createdAt: "",
            updatedAt: "",
          },
          definition: {
            id: "fridge",
            version: 1,
            name: "Fridge",
            category: "appliance",
            dimensionsMm: { widthMm: 900, heightMm: 1800, depthMm: 700 },
          },
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.startMm).toBeCloseTo(550, 6);
    expect(list[0]!.endMm).toBeCloseTo(1450, 6);
  });
});
