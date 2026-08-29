import { describe, expect, it } from "vitest";
import type { DoorOpening, WallDefinition } from "../types";
import { getDoorSwingGeometry } from "../door-swing";

const SOUTH_WALL: Pick<WallDefinition, "startMm" | "endMm"> = {
  startMm: { x: 0, z: 0 },
  endMm: { x: 4000, z: 0 },
};

function door(overrides: Partial<DoorOpening> = {}): DoorOpening {
  return {
    id: "d1",
    type: "door",
    offsetMm: 1000,
    widthMm: 900,
    heightMm: 2100,
    ...overrides,
  };
}

function approx(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

describe("getDoorSwingGeometry", () => {
  it("hinge at the left edge by default", () => {
    const g = getDoorSwingGeometry(SOUTH_WALL, door());
    expect(approx(g.hingeMm.x, 1000)).toBe(true);
    expect(approx(g.hingeMm.z, 0)).toBe(true);
  });

  it("hinge at right edge for hingeSide='right'", () => {
    const g = getDoorSwingGeometry(SOUTH_WALL, door({ hingeSide: "right" }));
    expect(approx(g.hingeMm.x, 1900)).toBe(true);
  });

  it("inward swing puts leaf-end on +Z (into the room) for a south wall", () => {
    const g = getDoorSwingGeometry(SOUTH_WALL, door({ swingDirection: "inward" }));
    // 90° open — leaf end perpendicular to wall along inward normal (0, +1)
    expect(approx(g.leafEndMm.x, 1000)).toBe(true);
    expect(approx(g.leafEndMm.z, 900)).toBe(true);
  });

  it("outward swing puts leaf-end on -Z", () => {
    const g = getDoorSwingGeometry(SOUTH_WALL, door({ swingDirection: "outward" }));
    expect(approx(g.leafEndMm.z, -900)).toBe(true);
  });

  it("arc includes start (closed) and end (90° open) points", () => {
    const g = getDoorSwingGeometry(SOUTH_WALL, door());
    // Start point: closed leaf lies along the wall in leafDir=+1 → (1000+900, 0) = (1900, 0).
    const start = g.arcPointsMm[0]!;
    const end = g.arcPointsMm.at(-1)!;
    expect(approx(start.x, 1900)).toBe(true);
    expect(approx(start.z, 0)).toBe(true);
    expect(approx(end.x, 1000)).toBe(true);
    expect(approx(end.z, 900)).toBe(true);
  });
});
