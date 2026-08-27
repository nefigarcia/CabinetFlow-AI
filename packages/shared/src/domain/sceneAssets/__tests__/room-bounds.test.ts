import { describe, expect, it } from "vitest";
import type { AABB } from "../aabb";
import {
  aabbBottomCenter,
  getRoomBoundsAabb,
  getRoomBoundsOverhang,
  getRoomBoundsViolations,
  isInsideRoomBounds,
} from "../room-bounds";

const ROOM = { widthMm: 4800, heightMm: 2400, depthMm: 3600 };

function aabb(min: AABB["min"], max: AABB["max"]): AABB {
  return { min, max };
}

describe("getRoomBoundsAabb", () => {
  it("returns an AABB from origin to room dimensions", () => {
    expect(getRoomBoundsAabb(ROOM)).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 4800, y: 2400, z: 3600 },
    });
  });
});

describe("isInsideRoomBounds", () => {
  it("returns true when AABB fits fully inside", () => {
    const a = aabb({ x: 100, y: 0, z: 100 }, { x: 500, y: 800, z: 500 });
    expect(isInsideRoomBounds(a, ROOM)).toBe(true);
  });

  it("returns true when AABB exactly touches all faces", () => {
    const a = aabb({ x: 0, y: 0, z: 0 }, { x: 4800, y: 2400, z: 3600 });
    expect(isInsideRoomBounds(a, ROOM)).toBe(true);
  });

  it("returns false when AABB pokes past any face", () => {
    expect(isInsideRoomBounds(aabb({ x: -1, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }), ROOM)).toBe(false);
    expect(isInsideRoomBounds(aabb({ x: 0, y: 0, z: 0 }, { x: 5000, y: 10, z: 10 }), ROOM)).toBe(false);
    expect(isInsideRoomBounds(aabb({ x: 0, y: 0, z: 0 }, { x: 10, y: 2500, z: 10 }), ROOM)).toBe(false);
    expect(isInsideRoomBounds(aabb({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 4000 }), ROOM)).toBe(false);
  });
});

describe("getRoomBoundsViolations", () => {
  it("returns [] when inside", () => {
    expect(getRoomBoundsViolations(aabb({ x: 100, y: 0, z: 100 }, { x: 500, y: 800, z: 500 }), ROOM)).toEqual([]);
  });

  it("detects OUTSIDE_LEFT", () => {
    expect(getRoomBoundsViolations(aabb({ x: -10, y: 0, z: 0 }, { x: 100, y: 100, z: 100 }), ROOM)).toContain("OUTSIDE_LEFT");
  });

  it("detects OUTSIDE_RIGHT", () => {
    expect(getRoomBoundsViolations(aabb({ x: 4700, y: 0, z: 0 }, { x: 5000, y: 100, z: 100 }), ROOM)).toContain("OUTSIDE_RIGHT");
  });

  it("detects OUTSIDE_BACK / OUTSIDE_FRONT (mapped to Z axis)", () => {
    expect(getRoomBoundsViolations(aabb({ x: 0, y: 0, z: -10 }, { x: 100, y: 100, z: 100 }), ROOM)).toContain("OUTSIDE_BACK");
    expect(getRoomBoundsViolations(aabb({ x: 0, y: 0, z: 3500 }, { x: 100, y: 100, z: 3700 }), ROOM)).toContain("OUTSIDE_FRONT");
  });

  it("detects BELOW_FLOOR and ABOVE_CEILING", () => {
    expect(getRoomBoundsViolations(aabb({ x: 0, y: -10, z: 0 }, { x: 100, y: 100, z: 100 }), ROOM)).toContain("BELOW_FLOOR");
    expect(getRoomBoundsViolations(aabb({ x: 0, y: 2300, z: 0 }, { x: 100, y: 2500, z: 100 }), ROOM)).toContain("ABOVE_CEILING");
  });

  it("emits multiple codes when an asset violates several directions at once", () => {
    const a = aabb({ x: -100, y: -100, z: -100 }, { x: 5000, y: 3000, z: 4000 });
    const violations = getRoomBoundsViolations(a, ROOM);
    expect(violations).toEqual(expect.arrayContaining([
      "OUTSIDE_LEFT",
      "OUTSIDE_RIGHT",
      "OUTSIDE_FRONT",
      "OUTSIDE_BACK",
      "BELOW_FLOOR",
      "ABOVE_CEILING",
    ]));
  });
});

describe("getRoomBoundsOverhang", () => {
  it("returns zero on every side for an inside AABB", () => {
    const o = getRoomBoundsOverhang(aabb({ x: 100, y: 0, z: 100 }, { x: 500, y: 800, z: 500 }), ROOM);
    expect(o).toEqual({ left: 0, right: 0, front: 0, back: 0, belowFloor: 0, aboveCeiling: 0 });
  });

  it("reports positive overhang on each violated side", () => {
    const o = getRoomBoundsOverhang(aabb({ x: -50, y: -25, z: 0 }, { x: 5000, y: 2500, z: 3800 }), ROOM);
    expect(o.left).toBe(50);
    expect(o.right).toBe(200);
    expect(o.belowFloor).toBe(25);
    expect(o.aboveCeiling).toBe(100);
    expect(o.front).toBe(200);
    expect(o.back).toBe(0);
  });
});

describe("aabbBottomCenter", () => {
  it("returns (mid X, min Y, mid Z)", () => {
    const c = aabbBottomCenter(aabb({ x: 100, y: 200, z: 300 }, { x: 500, y: 600, z: 700 }));
    expect(c).toEqual({ x: 300, y: 200, z: 500 });
  });
});
