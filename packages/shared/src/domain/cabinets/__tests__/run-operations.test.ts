import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import { deriveDefaultRoomArchitecture } from "../../architecture/legacy-adapter";
import { buildCabinetRuns } from "../cabinet-run";
import {
  chainAppendLeft,
  chainAppendRight,
  distributeRun,
  fitRunReport,
  insertAfter,
  moveCabinetToOffset,
  reorderRunTight,
} from "../run-operations";
import { withCabinetWallPlacement } from "../wall-placement";

const ROOM = { width: 4000, height: 2400, depth: 3000 };
const arch = deriveDefaultRoomArchitecture(ROOM);
const south = arch.walls.find((w) => w.id === "wall:south")!;

function cab(id: string, offsetMm: number, widthMm = 600): Cabinet {
  return {
    id,
    roomId: "r",
    orgId: "o",
    type: "base",
    name: id,
    width: widthMm,
    height: 720,
    depth: 560,
    posX: 0,
    posY: 0,
    posZ: 0,
    parameters: withCabinetWallPlacement(
      {},
      { wallId: south.id, offsetMm, baseElevationMm: 0, facing: "into-room" },
    ),
    materialId: null,
    parts: [],
    createdAt: "",
    updatedAt: "",
  };
}

describe("chainAppendRight", () => {
  it("empty run → offset 0", () => {
    const runs = buildCabinetRuns({ cabinets: [], walls: arch.walls });
    const r = chainAppendRight({
      run: { wallId: south.id, wall: south, items: [] },
      newCabinetWidthMm: 600,
      newCabinetType: "base",
      wall: south,
    });
    expect(r.placement.offsetMm).toBe(0);
    expect(r.fitsWithinWall).toBe(true);
    void runs; // silence unused
  });

  it("appends right of last cabinet", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600)],
      walls: arch.walls,
    });
    const r = chainAppendRight({
      run: runs[0]!,
      newCabinetWidthMm: 900,
      newCabinetType: "base",
      wall: south,
    });
    expect(r.placement.offsetMm).toBe(1200);
    expect(r.fitsWithinWall).toBe(true);
  });

  it("flags overflow beyond wall length", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 3400)],
      walls: arch.walls,
    });
    const r = chainAppendRight({
      run: runs[0]!,
      newCabinetWidthMm: 900,
      newCabinetType: "base",
      wall: south,
    });
    expect(r.fitsWithinWall).toBe(false);
  });

  it("wall cabinet appended right gets DEFAULT install height", () => {
    const runs = buildCabinetRuns({ cabinets: [], walls: arch.walls });
    const r = chainAppendRight({
      run: { wallId: south.id, wall: south, items: [] },
      newCabinetWidthMm: 600,
      newCabinetType: "wall",
      wall: south,
    });
    expect(r.placement.baseElevationMm).toBe(1400);
    void runs;
  });
});

describe("chainAppendLeft", () => {
  it("shifts existing cabinets right so new cabinet lands at offset 0", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600)],
      walls: arch.walls,
    });
    const r = chainAppendLeft({
      run: runs[0]!,
      newCabinetWidthMm: 450,
      newCabinetType: "base",
      wall: south,
    });
    expect(r.placement.offsetMm).toBe(0);
    expect(r.shiftMm).toBe(450);
  });

  it("no shift needed when there's room on the left", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 600), cab("b", 1200)],
      walls: arch.walls,
    });
    const r = chainAppendLeft({
      run: runs[0]!,
      newCabinetWidthMm: 400,
      newCabinetType: "base",
      wall: south,
    });
    expect(r.placement.offsetMm).toBe(200);
    expect(r.shiftMm).toBe(0);
  });
});

describe("insertAfter", () => {
  it("uses existing gap when large enough", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 1500)],
      walls: arch.walls,
    });
    const r = insertAfter({
      run: runs[0]!,
      newCabinetWidthMm: 600,
      newCabinetType: "base",
      wall: south,
      beforeCabinetId: "a",
    });
    expect(r.ok).toBe(true);
    expect(r.placement?.offsetMm).toBe(600);
    expect(r.shifts).toEqual([]);
  });

  it("shifts downstream cabinets when the gap is too small", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 700), cab("c", 1300)],
      walls: arch.walls,
    });
    const r = insertAfter({
      run: runs[0]!,
      newCabinetWidthMm: 400,
      newCabinetType: "base",
      wall: south,
      beforeCabinetId: "a",
    });
    expect(r.ok).toBe(true);
    expect(r.placement?.offsetMm).toBe(600);
    // Existing gap = 700-600 = 100; deficit = 400-100 = 300.
    expect(r.shifts?.map((s) => `${s.cabinetId}:${s.newOffsetMm}`)).toEqual([
      "b:1000",
      "c:1600",
    ]);
  });

  it("reports insufficient-space when the tail cabinet would fall off the wall", () => {
    // a: 0..600, b: 700..1300 (100 mm gap after a), c: 3400..4000 (tail).
    // Inserting width 600 after a forces shifting b + c by 500 mm; the
    // shifted c ends at 4500 mm — past the wall's 4000 mm limit.
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 700), cab("c", 3400)],
      walls: arch.walls,
    });
    const r = insertAfter({
      run: runs[0]!,
      newCabinetWidthMm: 600,
      newCabinetType: "base",
      wall: south,
      beforeCabinetId: "a",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("insufficient-space");
  });
});

describe("moveCabinetToOffset", () => {
  it("clamps to [0, wallLength - width]", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 100)],
      walls: arch.walls,
    });
    expect(moveCabinetToOffset({ run: runs[0]!, cabinetId: "a", targetOffsetMm: -50, wall: south })).toBe(0);
    expect(
      moveCabinetToOffset({ run: runs[0]!, cabinetId: "a", targetOffsetMm: 9999, wall: south }),
    ).toBe(3400);
  });
});

describe("reorderRunTight", () => {
  it("moves cabinet to a new index and repacks tightly", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600), cab("c", 1200)],
      walls: arch.walls,
    });
    const patches = reorderRunTight({ run: runs[0]!, cabinetId: "c", toIndex: 0 });
    // After: [c, a, b] at 0, 600, 1200 — c already needs to move to 0.
    expect(patches).toEqual([
      { cabinetId: "c", newOffsetMm: 0 },
      { cabinetId: "a", newOffsetMm: 600 },
      { cabinetId: "b", newOffsetMm: 1200 },
    ]);
  });
});

describe("distributeRun", () => {
  it("equal-gaps spreads slack across (n+1) gaps", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600), cab("c", 1200)],
      walls: arch.walls,
    });
    // Total width = 1800. Slack = 4000 - 1800 = 2200. Gap = 2200/4 = 550.
    const patches = distributeRun({ run: runs[0]!, wall: south, strategy: "equal-gaps" });
    expect(patches).toEqual([
      { cabinetId: "a", newOffsetMm: 550 },
      { cabinetId: "b", newOffsetMm: 1700 },
      { cabinetId: "c", newOffsetMm: 2850 },
    ]);
  });

  it("filler-at-ends puts half the slack at each end, cabinets tight in the middle", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600)],
      walls: arch.walls,
    });
    // Total = 1200; slack = 2800; half = 1400.
    const patches = distributeRun({ run: runs[0]!, wall: south, strategy: "filler-at-ends" });
    expect(patches).toEqual([
      { cabinetId: "a", newOffsetMm: 1400 },
      { cabinetId: "b", newOffsetMm: 2000 },
    ]);
  });

  it("no patches when there's overflow", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0, 3000), cab("b", 3000, 2000)],
      walls: arch.walls,
    });
    expect(distributeRun({ run: runs[0]!, wall: south, strategy: "equal-gaps" })).toEqual([]);
  });
});

describe("fitRunReport", () => {
  it("reports slack + a filler suggestion when the delta is small", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("b", 600)],
      walls: arch.walls,
    });
    const report = fitRunReport({ run: runs[0]!, usableSpanMm: 1275 });
    expect(report.deltaMm).toBeCloseTo(75, 6);
    expect(report.suggestions[0]!.kind).toBe("add-filler");
  });

  it("reports slack + a distribute suggestion when the delta is large", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0)],
      walls: arch.walls,
    });
    const report = fitRunReport({ run: runs[0]!, usableSpanMm: 4000 });
    expect(report.suggestions[0]!.kind).toBe("distribute-equal");
  });

  it("adds a resize suggestion for the nominated flexible cabinet", () => {
    const runs = buildCabinetRuns({
      cabinets: [cab("a", 0), cab("filler", 600, 100)],
      walls: arch.walls,
    });
    const report = fitRunReport({
      run: runs[0]!,
      usableSpanMm: 900,
      flexibleCabinetId: "filler",
    });
    // required = 700, available = 900, delta = 200.
    // filler current width = 100, resize target = 300.
    const resize = report.suggestions.find((s) => s.kind === "resize-cabinet");
    expect(resize?.labelMm).toBe(300);
    expect(resize?.targetCabinetId).toBe("filler");
  });
});
