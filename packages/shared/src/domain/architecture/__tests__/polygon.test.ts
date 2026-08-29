import { describe, expect, it } from "vitest";
import type { RoomArchitecture, WallDefinition } from "../types";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";
import {
  endpointGaps,
  extractFloorPolygon,
  pointInPolygon,
  polygonAabb,
  polygonSelfIntersections,
  polygonSignedArea2,
  polygonWinding,
  segmentsCrossProperly,
  triangulatePolygonFan,
} from "../polygon";

const ROOM = { width: 4000, height: 2400, depth: 3000 };

function customWalls(overrides?: Partial<WallDefinition>[]): RoomArchitecture {
  const base = deriveDefaultRoomArchitecture(ROOM);
  if (!overrides) return base;
  return {
    ...base,
    walls: base.walls.map((w, i) => ({ ...w, ...(overrides[i] ?? {}) })),
  };
}

describe("polygon", () => {
  it("extractFloorPolygon returns 4 corners for the legacy rectangle", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const p = extractFloorPolygon(arch);
    expect(p?.pointsMm.length).toBe(4);
    expect(p?.pointsMm[0]).toEqual({ x: 0, z: 0 });
  });

  it("extractFloorPolygon returns null for fewer than 3 walls", () => {
    const arch: RoomArchitecture = {
      schemaVersion: "1.0",
      walls: [
        { id: "a", startMm: { x: 0, z: 0 }, endMm: { x: 100, z: 0 }, heightMm: 100, thicknessMm: 50, openings: [] },
      ],
    };
    expect(extractFloorPolygon(arch)).toBeNull();
  });

  it("polygonWinding is ccw for the legacy rectangle", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(polygonWinding(extractFloorPolygon(arch)!)).toBe("ccw");
  });

  it("polygonSignedArea2 has correct sign", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const s = polygonSignedArea2(extractFloorPolygon(arch)!);
    // 4000 * 3000 * 2 = 24000000 (CCW → positive)
    expect(s).toBe(24_000_000);
  });

  it("pointInPolygon marks the center as inside and a distant point as outside", () => {
    const p = extractFloorPolygon(deriveDefaultRoomArchitecture(ROOM))!;
    expect(pointInPolygon({ x: 2000, z: 1500 }, p)).toBe(true);
    expect(pointInPolygon({ x: -500, z: -500 }, p)).toBe(false);
    expect(pointInPolygon({ x: 5000, z: 5000 }, p)).toBe(false);
  });

  it("polygonAabb of the legacy rectangle matches the room dims", () => {
    const p = extractFloorPolygon(deriveDefaultRoomArchitecture(ROOM))!;
    expect(polygonAabb(p)).toEqual({
      min: { x: 0, z: 0 },
      max: { x: ROOM.width, z: ROOM.depth },
    });
  });

  it("triangulatePolygonFan splits the legacy rectangle into 2 triangles", () => {
    const p = extractFloorPolygon(deriveDefaultRoomArchitecture(ROOM))!;
    expect(triangulatePolygonFan(p)).toHaveLength(2);
  });

  it("segmentsCrossProperly detects a proper crossing", () => {
    expect(
      segmentsCrossProperly(
        { x: 0, z: 0 },
        { x: 10, z: 10 },
        { x: 0, z: 10 },
        { x: 10, z: 0 },
      ),
    ).toBe(true);
  });

  it("segmentsCrossProperly rejects touching at a shared endpoint", () => {
    expect(
      segmentsCrossProperly(
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ),
    ).toBe(false);
  });

  it("polygonSelfIntersections is empty for the legacy rectangle", () => {
    const p = extractFloorPolygon(deriveDefaultRoomArchitecture(ROOM))!;
    expect(polygonSelfIntersections(p)).toEqual([]);
  });

  it("endpointGaps are all zero for the legacy rectangle", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const gaps = endpointGaps(arch.walls);
    expect(gaps.every((g) => g === 0)).toBe(true);
  });

  it("endpointGaps flags a broken chain", () => {
    const arch = customWalls([undefined, { endMm: { x: 3999, z: 3000 } }]);
    const gaps = endpointGaps(arch.walls);
    // The east wall ends at (3999, 3000); the north wall starts at (4000, 3000).
    expect(gaps[1]).toBeCloseTo(1, 6);
  });
});
