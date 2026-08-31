import { describe, expect, it } from "vitest";
import type { WallDefinition, WallOpening } from "../types";
import { compileWall } from "../wall-compiler";

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

function window_(id: string, offsetMm: number, widthMm: number, sillHeightMm: number, heightMm = 1200): WallOpening {
  return { id, type: "window", offsetMm, widthMm, heightMm, sillHeightMm };
}

describe("compileWall", () => {
  it("emits a single full-height segment for a wall with no openings", () => {
    const w = wall();
    const c = compileWall(w);
    expect(c.segments).toHaveLength(1);
    expect(c.segments[0]).toMatchObject({
      wallId: "w",
      xStartMm: 0,
      xEndMm: 4000,
      yBottomMm: 0,
      yTopMm: 2400,
    });
    expect(c.openings).toEqual([]);
  });

  it("compiles a door: left segment + header + right segment (3 pieces)", () => {
    const c = compileWall(
      wall({ openings: [door("d1", 800, 900)] }),
    );
    // Left solid: 0..800 full-height
    // Header:   800..1700 y = 2100..2400
    // Right:    1700..4000 full-height
    expect(c.segments).toHaveLength(3);
    const left = c.segments.find((s) => s.xStartMm === 0)!;
    expect(left).toMatchObject({ xEndMm: 800, yBottomMm: 0, yTopMm: 2400 });
    const header = c.segments.find(
      (s) => s.xStartMm === 800 && s.xEndMm === 1700,
    )!;
    expect(header).toMatchObject({ yBottomMm: 2100, yTopMm: 2400 });
    const right = c.segments.find((s) => s.xStartMm === 1700)!;
    expect(right).toMatchObject({ xEndMm: 4000, yBottomMm: 0, yTopMm: 2400 });
    expect(c.openings).toHaveLength(1);
    expect(c.openings[0]).toMatchObject({
      openingId: "d1",
      type: "door",
      xStartMm: 800,
      xEndMm: 1700,
      yBottomMm: 0,
      yTopMm: 2100,
    });
  });

  it("compiles a window: sill + header + flanking solids (4 pieces)", () => {
    const c = compileWall(
      wall({ openings: [window_("w1", 1000, 1200, 900)] }),
    );
    // sill:   1000..2200 y = 0..900
    // header: 1000..2200 y = 2100..2400
    // left:   0..1000 full-height
    // right:  2200..4000 full-height
    expect(c.segments).toHaveLength(4);
    const sill = c.segments.find(
      (s) => s.xStartMm === 1000 && s.yBottomMm === 0,
    )!;
    expect(sill).toMatchObject({ xEndMm: 2200, yTopMm: 900 });
    const header = c.segments.find(
      (s) => s.xStartMm === 1000 && s.yTopMm === 2400,
    )!;
    expect(header).toMatchObject({ xEndMm: 2200, yBottomMm: 2100 });
    expect(c.openings[0]).toMatchObject({
      openingId: "w1",
      type: "window",
      yBottomMm: 900,
      yTopMm: 2100,
    });
  });

  it("multi-openings on the same wall: each contributes deterministic pieces", () => {
    const c = compileWall(
      wall({
        openings: [
          door("d1", 500, 900),
          window_("w1", 2500, 1200, 900),
        ],
      }),
    );
    // Expected segments (sorted by x, then y):
    //  0..500       0..2400  (left full)
    //  500..1400    2100..2400 (door header)
    //  1400..2500   0..2400  (between door + window)
    //  2500..3700   0..900   (window sill)
    //  2500..3700   2100..2400 (window header)
    //  3700..4000   0..2400  (right full)
    expect(c.segments).toHaveLength(6);
  });

  it("opening clipped to wall bounds does not emit invalid segments", () => {
    const c = compileWall(
      wall({ openings: [door("d1", 3800, 900)] }),
    );
    // Door starts at 3800 but width extends to 4700 — clipped to 3800..4000.
    // Left solid: 0..3800 full-height
    // Header:   3800..4000 y = 2100..2400
    // (no right solid since clipped to wall end)
    const left = c.segments.find((s) => s.xStartMm === 0)!;
    expect(left).toMatchObject({ xEndMm: 3800, yTopMm: 2400 });
    const header = c.segments.find(
      (s) => s.xStartMm === 3800 && s.yBottomMm === 2100,
    )!;
    expect(header).toMatchObject({ xEndMm: 4000, yTopMm: 2400 });
    // No solid past xEnd 4000
    for (const seg of c.segments) {
      expect(seg.xEndMm).toBeLessThanOrEqual(4000);
    }
  });

  it("opening entirely off the wall emits no opening (silently dropped)", () => {
    const c = compileWall(
      wall({ openings: [door("d1", 5000, 900)] }),
    );
    // Should still produce a full-height solid wall.
    expect(c.segments).toHaveLength(1);
    expect(c.openings).toHaveLength(0);
  });

  it("compiled openings are never treated as solids (renderer distinguishes)", () => {
    const c = compileWall(
      wall({ openings: [door("d1", 800, 900)] }),
    );
    for (const opening of c.openings) {
      // No segment should occupy the door's clear region (0..2100 above floor).
      for (const seg of c.segments) {
        const xOverlap = !(
          seg.xEndMm <= opening.xStartMm || seg.xStartMm >= opening.xEndMm
        );
        const yOverlap = !(
          seg.yTopMm <= opening.yBottomMm || seg.yBottomMm >= opening.yTopMm
        );
        expect(xOverlap && yOverlap).toBe(false);
      }
    }
  });

  it("does not mutate the input wall", () => {
    const w = wall({ openings: [door("d1", 800, 900)] });
    const snap = JSON.stringify(w);
    compileWall(w);
    expect(JSON.stringify(w)).toBe(snap);
  });
});
