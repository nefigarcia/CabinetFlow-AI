import { describe, expect, it } from "vitest";
import type { RoomArchitecture, WallDefinition } from "../types";
import { ROOM_ARCHITECTURE_SCHEMA_VERSION } from "../types";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";
import { extractFloorPolygon, polygonAabb } from "../polygon";
import {
  getExteriorFaceWorldPointMm,
  getInteriorFaceWorldPointMm,
  getWallRenderTransform,
} from "../wall-render-transform";

// Semantic contract these tests enforce (see wall-render-transform.ts):
//   · The architecture design line IS the interior wall face.
//   · The floor polygon (from extractFloorPolygon, which walks wall
//     start points) therefore sits on the interior faces.
//   · Wall meshes must extend OUTWARD from the design line only.
//
// These tests are pure — no THREE.js. They verify the math that
// RoomShell.tsx consumes via getWallRenderTransform.

function approxEqual(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

const ROOM_4x3 = { width: 4000, height: 2400, depth: 3000 };

describe("Legacy rectangular room 4000 × 3000, 50 mm walls", () => {
  const arch = deriveDefaultRoomArchitecture(ROOM_4x3);
  const [south, east, north, west] = arch.walls;

  it("floor polygon bounds are the room interior (0..W, 0..D)", () => {
    const p = extractFloorPolygon(arch)!;
    const b = polygonAabb(p)!;
    expect(b).toEqual({
      min: { x: 0, z: 0 },
      max: { x: ROOM_4x3.width, z: ROOM_4x3.depth },
    });
  });

  it("south wall: interior face at Z=0, exterior face at Z=-50", () => {
    const interior = getInteriorFaceWorldPointMm(south!, south!.startMm.x + 100, 0);
    const exterior = getExteriorFaceWorldPointMm(south!, south!.startMm.x + 100, 0);
    expect(approxEqual(interior.z, 0)).toBe(true);
    expect(approxEqual(exterior.z, -50)).toBe(true);
  });

  it("north wall: interior face at Z=3000, exterior face at Z=3050", () => {
    const interior = getInteriorFaceWorldPointMm(north!, 100, 0);
    const exterior = getExteriorFaceWorldPointMm(north!, 100, 0);
    expect(approxEqual(interior.z, ROOM_4x3.depth)).toBe(true);
    expect(approxEqual(exterior.z, ROOM_4x3.depth + 50)).toBe(true);
  });

  it("west wall: interior face at X=0, exterior at X=-50", () => {
    const interior = getInteriorFaceWorldPointMm(west!, 100, 0);
    const exterior = getExteriorFaceWorldPointMm(west!, 100, 0);
    expect(approxEqual(interior.x, 0)).toBe(true);
    expect(approxEqual(exterior.x, -50)).toBe(true);
  });

  it("east wall: interior face at X=4000, exterior at X=4050", () => {
    const interior = getInteriorFaceWorldPointMm(east!, 100, 0);
    const exterior = getExteriorFaceWorldPointMm(east!, 100, 0);
    expect(approxEqual(interior.x, ROOM_4x3.width)).toBe(true);
    expect(approxEqual(exterior.x, ROOM_4x3.width + 50)).toBe(true);
  });

  it("floor polygon vertices all lie on some interior wall face", () => {
    const poly = extractFloorPolygon(arch)!;
    // Every polygon vertex should equal the interior face at offset=0
    // for the wall whose start it is.
    for (let i = 0; i < arch.walls.length; i++) {
      const w = arch.walls[i]!;
      const v = poly.pointsMm[i]!;
      const interior = getInteriorFaceWorldPointMm(w, 0, 0);
      expect(approxEqual(v.x, interior.x)).toBe(true);
      expect(approxEqual(v.z, interior.z)).toBe(true);
    }
  });

  it("render transform for south wall: origin outward by FULL thickness (Z=-50)", () => {
    const t = getWallRenderTransform(south!);
    expect(t.originMm).toEqual({ x: 0, z: -50 });
    expect(approxEqual(t.rotationY, 0)).toBe(true);
    expect(t.lengthMm).toBe(4000);
    expect(t.thicknessMm).toBe(50);
  });

  it("render transform for east wall: origin outward at X=W+50, rotated -π/2", () => {
    const t = getWallRenderTransform(east!);
    expect(t.originMm.x).toBeCloseTo(ROOM_4x3.width + 50, 6);
    expect(t.originMm.z).toBe(0);
    expect(t.rotationY).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("render transform for north wall: origin outward at Z=D+50, rotated -π", () => {
    const t = getWallRenderTransform(north!);
    expect(t.originMm.z).toBeCloseTo(ROOM_4x3.depth + 50, 6);
    expect(Math.abs(Math.abs(t.rotationY) - Math.PI)).toBeLessThan(1e-6);
  });

  it("render transform for west wall: origin outward at X=-50, rotated +π/2", () => {
    const t = getWallRenderTransform(west!);
    expect(t.originMm.x).toBeCloseTo(-50, 6);
    expect(t.originMm.z).toBe(3000);
    expect(t.rotationY).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("Arbitrary wall thickness (200 mm)", () => {
  const arch = deriveDefaultRoomArchitecture(ROOM_4x3);
  for (const w of arch.walls) w.thicknessMm = 200;

  it("south wall: interior at Z=0, exterior at Z=-200", () => {
    const [south] = arch.walls;
    expect(approxEqual(getInteriorFaceWorldPointMm(south!, 100, 0).z, 0)).toBe(true);
    expect(approxEqual(getExteriorFaceWorldPointMm(south!, 100, 0).z, -200)).toBe(true);
  });

  it("render transform's origin scales linearly with thickness", () => {
    const t = getWallRenderTransform(arch.walls[0]!);
    expect(t.originMm.z).toBe(-200);
  });

  it("floor polygon bounds are unchanged (interior contract holds at any thickness)", () => {
    const b = polygonAabb(extractFloorPolygon(arch)!)!;
    expect(b).toEqual({
      min: { x: 0, z: 0 },
      max: { x: ROOM_4x3.width, z: ROOM_4x3.depth },
    });
  });
});

describe("L-shaped custom room", () => {
  // L-shape: outer rectangle 5000 x 4000 minus a 2000 x 2000 corner at (3000, 2000).
  //
  //   z=4000  +--------+
  //           |        |
  //           |    A   |
  //   z=2000  +----+   |
  //                |   |
  //                | B |
  //   z=0     +----+---+
  //           0   3000 5000
  //
  // 6 walls, CCW starting from the south:
  //   0: south         (0,0)   → (5000,0)
  //   1: east          (5000,0) → (5000,4000)
  //   2: north         (5000,4000) → (3000,4000)
  //   3: west-of-A     (3000,4000) → (3000,2000)
  //   4: south-of-A    (3000,2000) → (0,2000)
  //   5: west          (0,2000)   → (0,0)
  const arch: RoomArchitecture = {
    schemaVersion: ROOM_ARCHITECTURE_SCHEMA_VERSION,
    walls: [
      { id: "s", startMm: { x: 0, z: 0 }, endMm: { x: 5000, z: 0 }, heightMm: 2400, thicknessMm: 50, openings: [] },
      { id: "e", startMm: { x: 5000, z: 0 }, endMm: { x: 5000, z: 4000 }, heightMm: 2400, thicknessMm: 50, openings: [] },
      { id: "n", startMm: { x: 5000, z: 4000 }, endMm: { x: 3000, z: 4000 }, heightMm: 2400, thicknessMm: 50, openings: [] },
      { id: "w-A", startMm: { x: 3000, z: 4000 }, endMm: { x: 3000, z: 2000 }, heightMm: 2400, thicknessMm: 50, openings: [] },
      { id: "s-A", startMm: { x: 3000, z: 2000 }, endMm: { x: 0, z: 2000 }, heightMm: 2400, thicknessMm: 50, openings: [] },
      { id: "w", startMm: { x: 0, z: 2000 }, endMm: { x: 0, z: 0 }, heightMm: 2400, thicknessMm: 50, openings: [] },
    ],
  };

  it("floor polygon has 6 vertices matching the L profile", () => {
    const p = extractFloorPolygon(arch)!;
    expect(p.pointsMm).toEqual([
      { x: 0, z: 0 },
      { x: 5000, z: 0 },
      { x: 5000, z: 4000 },
      { x: 3000, z: 4000 },
      { x: 3000, z: 2000 },
      { x: 0, z: 2000 },
    ]);
  });

  it("every floor polygon vertex sits on its wall's interior face at offset=0", () => {
    const p = extractFloorPolygon(arch)!;
    for (let i = 0; i < arch.walls.length; i++) {
      const wall = arch.walls[i]!;
      const v = p.pointsMm[i]!;
      const interior = getInteriorFaceWorldPointMm(wall, 0, 0);
      expect(approxEqual(v.x, interior.x)).toBe(true);
      expect(approxEqual(v.z, interior.z)).toBe(true);
    }
  });

  it("interior corner (west-of-A ↔ south-of-A) walls push outward AWAY from the room notch", () => {
    // The `west-of-A` wall runs north→south along X=3000, with inward
    // normal pointing +X (INTO the room's B leg). Its exterior face
    // sits at X = 3000 + (-inwardX) * thickness = 3000 + (-1)*50 = 2950
    // — INTO the notch (which is outside the room).
    const wA = arch.walls[3]!;
    const exterior = getExteriorFaceWorldPointMm(wA, 100, 0);
    expect(approxEqual(exterior.x, 2950)).toBe(true);
    expect(approxEqual(exterior.z, 4000 - 100)).toBe(true);
  });
});
