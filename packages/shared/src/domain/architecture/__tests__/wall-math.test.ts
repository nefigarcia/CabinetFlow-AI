import { describe, expect, it } from "vitest";
import type { WallDefinition } from "../types";
import {
  getWallFrame,
  getWallLengthMm,
  wallLocalToWorld,
  worldToWallLocal,
} from "../wall-math";

function wall(sx: number, sz: number, ex: number, ez: number): WallDefinition {
  return {
    id: "w",
    startMm: { x: sx, z: sz },
    endMm: { x: ex, z: ez },
    heightMm: 2400,
    thicknessMm: 50,
    openings: [],
  };
}

describe("getWallFrame", () => {
  it("south wall: length = width, angle 0, tangent (+1,0), inward normal (0,+1)", () => {
    // Room extends from z=0 to z=+D. A south wall (z=0) has interior in
    // the +Z direction. The (-tz, tx) formula gives inward normal (0, +1)
    // for tangent (1, 0). ✓
    const f = getWallFrame(wall(0, 0, 5000, 0));
    expect(f.lengthMm).toBe(5000);
    expect(f.angleRad).toBe(0);
    expect(f.tangent).toEqual({ x: 1, z: 0 });
    expect(f.normal.x).toBeCloseTo(0, 12);
    expect(f.normal.z).toBeCloseTo(1, 12);
  });

  it("legacy east wall inward normal points -X (into room from x=W wall)", () => {
    const f = getWallFrame(wall(5000, 0, 5000, 3000));
    expect(f.tangent).toEqual({ x: 0, z: 1 });
    expect(f.normal.x).toBeCloseTo(-1, 12);
    expect(f.normal.z).toBeCloseTo(0, 12);
  });

  it("legacy west wall inward normal points +X (into room from x=0 wall)", () => {
    const f = getWallFrame(wall(0, 3000, 0, 0));
    expect(f.tangent).toEqual({ x: 0, z: -1 });
    expect(f.normal.x).toBeCloseTo(1, 12);
    expect(f.normal.z).toBeCloseTo(0, 12);
  });

  it("north wall: reversed direction still produces unit tangent", () => {
    const f = getWallFrame(wall(5000, 3000, 0, 3000));
    expect(f.lengthMm).toBe(5000);
    expect(f.tangent).toEqual({ x: -1, z: 0 });
    expect(f.angleRad).toBeCloseTo(Math.PI, 12);
  });

  it("east wall: (W,0)→(W,D), tangent (0,+1)", () => {
    const f = getWallFrame(wall(5000, 0, 5000, 3000));
    expect(f.tangent).toEqual({ x: 0, z: 1 });
    expect(f.angleRad).toBeCloseTo(Math.PI / 2, 12);
  });

  it("diagonal wall: 3-4-5 triangle length + correct tangent", () => {
    const f = getWallFrame(wall(0, 0, 4000, 3000));
    expect(f.lengthMm).toBe(5000);
    expect(f.tangent.x).toBeCloseTo(0.8, 12);
    expect(f.tangent.z).toBeCloseTo(0.6, 12);
  });

  it("zero-length wall returns defensive tangent/normal without NaN", () => {
    const f = getWallFrame(wall(1000, 1000, 1000, 1000));
    expect(f.lengthMm).toBe(0);
    expect(f.tangent).toEqual({ x: 1, z: 0 });
    expect(f.normal).toEqual({ x: 0, z: 1 });
    expect(Number.isNaN(f.angleRad)).toBe(false);
  });

  it("tangent and inward normal are perpendicular", () => {
    const f = getWallFrame(wall(0, 0, 4000, 3000));
    const dot = f.tangent.x * f.normal.x + f.tangent.z * f.normal.z;
    expect(Math.abs(dot)).toBeLessThan(1e-9);
  });
});

describe("wallLocalToWorld / worldToWallLocal", () => {
  it("wall start maps to world start; wall end maps to world end", () => {
    const w = wall(0, 0, 5000, 0);
    const f = getWallFrame(w);
    expect(wallLocalToWorld(f, { xMm: 0, yMm: 0, zMm: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(wallLocalToWorld(f, { xMm: 5000, yMm: 0, zMm: 0 })).toEqual({ x: 5000, y: 0, z: 0 });
  });

  it("Y is preserved through both transforms", () => {
    const f = getWallFrame(wall(0, 0, 4000, 3000));
    const world = wallLocalToWorld(f, { xMm: 500, yMm: 1234, zMm: 0 });
    expect(world.y).toBe(1234);
    expect(worldToWallLocal(f, world).yMm).toBe(1234);
  });

  it("round-trips arbitrary wall-local points", () => {
    const f = getWallFrame(wall(1000, 2000, 5000, 3500));
    for (const p of [
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 500, yMm: 100, zMm: 0 },
      { xMm: 2000, yMm: 2000, zMm: 25 },
      { xMm: 4270, yMm: 1200, zMm: -50 },
    ]) {
      const w = wallLocalToWorld(f, p);
      const back = worldToWallLocal(f, w);
      expect(back.xMm).toBeCloseTo(p.xMm, 6);
      expect(back.yMm).toBeCloseTo(p.yMm, 6);
      expect(back.zMm).toBeCloseTo(p.zMm, 6);
    }
  });

  it("world point on wall's tangent axis at local X moves along wall by the tangent unit", () => {
    const f = getWallFrame(wall(0, 0, 4000, 3000));
    const world = wallLocalToWorld(f, { xMm: 5000, yMm: 0, zMm: 0 });
    // 5000 along a (0.8, 0.6) tangent = (4000, y=0, 3000)
    expect(world.x).toBeCloseTo(4000, 9);
    expect(world.z).toBeCloseTo(3000, 9);
  });
});

describe("getWallLengthMm", () => {
  it("matches Euclidean distance for arbitrary walls", () => {
    expect(getWallLengthMm(wall(0, 0, 5000, 0))).toBe(5000);
    expect(getWallLengthMm(wall(0, 0, 3000, 4000))).toBe(5000);
    expect(getWallLengthMm(wall(1000, 2000, 1000, 2000))).toBe(0);
  });
});
