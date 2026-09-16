import { describe, expect, it } from "vitest";
import type { WallDefinition } from "../../architecture/types";
import {
  clampCabinetOffset,
  projectWorldPointToCabinetWallOffset,
  snapCabinetOffset,
  type SnapTarget,
} from "../wall-drag";

// Wall test scaffold: axis-aligned walls of varying orientation so the
// drag math is exercised in every direction the room compiler emits.
//
// Rooms use the (X=east, Z=south) convention; walls run counterclockwise
// so their tangents point AROUND the room interior.

function southWall(): WallDefinition {
  return {
    id: "south",
    startMm: { x: 0, z: 0 },
    endMm: { x: 4000, z: 0 },
    heightMm: 2700,
    thicknessMm: 100,
    openings: [],
  };
}
function eastWall(): WallDefinition {
  return {
    id: "east",
    startMm: { x: 4000, z: 0 },
    endMm: { x: 4000, z: 3000 },
    heightMm: 2700,
    thicknessMm: 100,
    openings: [],
  };
}
function northWall(): WallDefinition {
  return {
    id: "north",
    startMm: { x: 4000, z: 3000 },
    endMm: { x: 0, z: 3000 },
    heightMm: 2700,
    thicknessMm: 100,
    openings: [],
  };
}
function westWall(): WallDefinition {
  return {
    id: "west",
    startMm: { x: 0, z: 3000 },
    endMm: { x: 0, z: 0 },
    heightMm: 2700,
    thicknessMm: 100,
    openings: [],
  };
}

describe("projectWorldPointToCabinetWallOffset", () => {
  it("south wall: pointer at center of 4000mm-long wall yields left-edge = 2000 - width/2", () => {
    const offset = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 2000, z: 0 },
      wall: southWall(),
      cabinetWidthMm: 600,
    });
    expect(offset).toBeCloseTo(1700); // 2000 - 300
  });

  it("east wall: pointer at wall midpoint yields half-length - width/2", () => {
    const offset = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 4000, z: 1500 },
      wall: eastWall(),
      cabinetWidthMm: 600,
    });
    expect(offset).toBeCloseTo(1200); // 1500 - 300
  });

  it("north wall: reversed tangent still projects a 1500mm interior point to ~2200 on the wall", () => {
    // North wall runs from (4000, 3000) → (0, 3000). Interior point at
    // (1500, 3000) sits 2500 mm from the start of the wall.
    const offset = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 1500, z: 3000 },
      wall: northWall(),
      cabinetWidthMm: 600,
    });
    expect(offset).toBeCloseTo(2200); // 2500 - 300
  });

  it("west wall: pointer inside room projects onto the wall tangent correctly", () => {
    // West wall runs from (0, 3000) → (0, 0). Interior point (0, 1000)
    // is 2000 mm from the start.
    const offset = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 0, z: 1000 },
      wall: westWall(),
      cabinetWidthMm: 600,
    });
    expect(offset).toBeCloseTo(1700); // 2000 - 300
  });

  it("y coordinate of the world point is ignored (2D floor drag)", () => {
    const withY0 = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 2000, z: 0 },
      wall: southWall(),
      cabinetWidthMm: 600,
    });
    const withY1 = projectWorldPointToCabinetWallOffset({
      worldPoint: { x: 2000, z: 0 },
      wall: southWall(),
      cabinetWidthMm: 600,
    });
    expect(withY0).toBeCloseTo(withY1);
  });
});

describe("clampCabinetOffset — width-aware", () => {
  it("clamps a negative offset to 0", () => {
    expect(
      clampCabinetOffset({
        offsetMm: -500,
        cabinetWidthMm: 600,
        wallLengthMm: 4000,
      }),
    ).toBe(0);
  });

  it("clamps an over-far offset to (wallLength - cabinetWidth)", () => {
    // A 600mm cabinet on a 4000mm wall CAN sit at offset 3400 (right edge
    // hits the wall end) but no further.
    expect(
      clampCabinetOffset({
        offsetMm: 4000,
        cabinetWidthMm: 600,
        wallLengthMm: 4000,
      }),
    ).toBe(3400);
  });

  it("permits the exact boundary values", () => {
    expect(
      clampCabinetOffset({
        offsetMm: 0,
        cabinetWidthMm: 600,
        wallLengthMm: 4000,
      }),
    ).toBe(0);
    expect(
      clampCabinetOffset({
        offsetMm: 3400,
        cabinetWidthMm: 600,
        wallLengthMm: 4000,
      }),
    ).toBe(3400);
  });

  it("returns 0 for a cabinet wider than the wall (nonsense config)", () => {
    expect(
      clampCabinetOffset({
        offsetMm: 100,
        cabinetWidthMm: 5000,
        wallLengthMm: 4000,
      }),
    ).toBe(0);
  });

  it("returns 0 for NaN offset (guards accidental float misuse)", () => {
    expect(
      clampCabinetOffset({
        offsetMm: Number.NaN,
        cabinetWidthMm: 600,
        wallLengthMm: 4000,
      }),
    ).toBe(0);
  });
});

describe("snapCabinetOffset", () => {
  const cabinetWidthMm = 600;
  const wallStart: SnapTarget = { offsetMm: 0, edge: "left", reason: "wall-start" };
  const wallEnd: SnapTarget = { offsetMm: 4000, edge: "right", reason: "wall-end" };
  const neighborRight: SnapTarget = {
    offsetMm: 1200,
    edge: "left",
    reason: "neighbor-right-edge",
  };

  it("snaps to wall-start when within tolerance", () => {
    const result = snapCabinetOffset({
      offsetMm: 5,
      cabinetWidthMm,
      targets: [wallStart, wallEnd, neighborRight],
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(true);
    expect(result.offsetMm).toBe(0);
    expect(result.snappedTo?.reason).toBe("wall-start");
  });

  it("snaps the RIGHT edge to wall-end (cabinet fills the last segment)", () => {
    // The wall-end target says "right edge at 4000". For a 600mm cabinet
    // that means left edge at 3400.
    const result = snapCabinetOffset({
      offsetMm: 3395,
      cabinetWidthMm,
      targets: [wallStart, wallEnd, neighborRight],
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(true);
    expect(result.offsetMm).toBe(3400);
    expect(result.snappedTo?.reason).toBe("wall-end");
  });

  it("snaps to the adjacent cabinet's right edge (left-to-left)", () => {
    const result = snapCabinetOffset({
      offsetMm: 1198,
      cabinetWidthMm,
      targets: [wallStart, wallEnd, neighborRight],
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(true);
    expect(result.offsetMm).toBe(1200);
  });

  it("prefers the CLOSER target when multiple are within tolerance", () => {
    // Two targets both within 10mm — pick the closer.
    const targets: SnapTarget[] = [
      { offsetMm: 1000, edge: "left", reason: "far" },
      { offsetMm: 1005, edge: "left", reason: "near" },
    ];
    const result = snapCabinetOffset({
      offsetMm: 1004,
      cabinetWidthMm,
      targets,
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(true);
    expect(result.snappedTo?.reason).toBe("near");
  });

  it("returns the input unchanged when no target is within tolerance", () => {
    const result = snapCabinetOffset({
      offsetMm: 2500,
      cabinetWidthMm,
      targets: [wallStart, wallEnd, neighborRight],
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(false);
    expect(result.offsetMm).toBe(2500);
  });

  it("works with an empty target list (no-op)", () => {
    const result = snapCabinetOffset({
      offsetMm: 1000,
      cabinetWidthMm,
      targets: [],
      toleranceMm: 10,
    });
    expect(result.snapped).toBe(false);
    expect(result.offsetMm).toBe(1000);
  });
});
