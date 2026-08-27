import { describe, expect, it } from "vitest";
import type { WallDefinition, WallOpening } from "../types";
import { validateArchitecture, validateWall } from "../validation";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";

function wall(overrides: Partial<WallDefinition> = {}): WallDefinition {
  return {
    id: "w",
    startMm: { x: 0, z: 0 },
    endMm: { x: 4000, z: 0 },
    heightMm: 2400,
    thicknessMm: 50,
    openings: [],
    ...overrides,
  };
}

function door(id: string, offsetMm: number, widthMm: number, heightMm = 2100): WallOpening {
  return { id, type: "door", offsetMm, widthMm, heightMm };
}

describe("validateWall", () => {
  it("clean wall with no openings returns []", () => {
    expect(validateWall(wall())).toEqual([]);
  });

  it("zero-length wall emits WALL_ZERO_LENGTH error", () => {
    const issues = validateWall(wall({ endMm: { x: 0, z: 0 } }));
    expect(issues.some((i) => i.code === "WALL_ZERO_LENGTH" && i.severity === "error")).toBe(true);
  });

  it("negative height emits WALL_NEGATIVE_HEIGHT error", () => {
    const issues = validateWall(wall({ heightMm: -100 }));
    expect(issues.some((i) => i.code === "WALL_NEGATIVE_HEIGHT")).toBe(true);
  });

  it("negative thickness emits WALL_NEGATIVE_THICKNESS error", () => {
    const issues = validateWall(wall({ thicknessMm: 0 }));
    expect(issues.some((i) => i.code === "WALL_NEGATIVE_THICKNESS")).toBe(true);
  });

  it("opening with non-positive width emits OPENING_NON_POSITIVE_WIDTH", () => {
    const issues = validateWall(wall({ openings: [door("d1", 100, 0)] }));
    expect(issues.some((i) => i.code === "OPENING_NON_POSITIVE_WIDTH")).toBe(true);
  });

  it("opening past end of wall emits OPENING_OUTSIDE_WALL warning", () => {
    const issues = validateWall(wall({ openings: [door("d1", 3500, 700)] }));
    expect(issues.some((i) => i.code === "OPENING_OUTSIDE_WALL")).toBe(true);
  });

  it("negative offset emits OPENING_OFFSET_NEGATIVE warning", () => {
    const issues = validateWall(wall({ openings: [door("d1", -100, 500)] }));
    expect(issues.some((i) => i.code === "OPENING_OFFSET_NEGATIVE")).toBe(true);
  });

  it("opening taller than wall emits OPENING_ABOVE_CEILING warning", () => {
    const issues = validateWall(wall({ openings: [door("d1", 500, 900, 3000)] }));
    expect(issues.some((i) => i.code === "OPENING_ABOVE_CEILING")).toBe(true);
  });

  it("window with negative sill emits WINDOW_SILL_NEGATIVE", () => {
    const issues = validateWall(
      wall({
        openings: [
          { id: "w1", type: "window", offsetMm: 500, widthMm: 900, heightMm: 1200, sillHeightMm: -50 },
        ],
      }),
    );
    expect(issues.some((i) => i.code === "WINDOW_SILL_NEGATIVE")).toBe(true);
  });

  it("overlapping openings emit OPENING_OVERLAP warning", () => {
    const issues = validateWall(
      wall({ openings: [door("d1", 500, 1000), door("d2", 1200, 900)] }),
    );
    expect(issues.some((i) => i.code === "OPENING_OVERLAP")).toBe(true);
  });

  it("touching openings (edge to edge) do NOT emit overlap warning", () => {
    const issues = validateWall(
      wall({ openings: [door("d1", 500, 500), door("d2", 1000, 500)] }),
    );
    expect(issues.some((i) => i.code === "OPENING_OVERLAP")).toBe(false);
  });

  it("every issue carries source = 'architecture'", () => {
    const issues = validateWall(wall({ heightMm: -1, openings: [door("d1", 5000, 100)] }));
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) expect(i.source).toBe("architecture");
  });
});

describe("validateArchitecture", () => {
  it("legacy rectangular architecture is fully valid (no issues)", () => {
    const arch = deriveDefaultRoomArchitecture({ width: 4000, height: 2400, depth: 3000 });
    expect(validateArchitecture(arch)).toEqual([]);
  });

  it("propagates issues from every wall", () => {
    const arch = deriveDefaultRoomArchitecture({ width: 4000, height: 2400, depth: 3000 });
    arch.walls[0]!.openings.push(door("d1", -100, 500));
    arch.walls[1]!.heightMm = 0;
    const issues = validateArchitecture(arch);
    expect(issues.some((i) => i.code === "OPENING_OFFSET_NEGATIVE")).toBe(true);
    expect(issues.some((i) => i.code === "WALL_NEGATIVE_HEIGHT")).toBe(true);
  });
});
