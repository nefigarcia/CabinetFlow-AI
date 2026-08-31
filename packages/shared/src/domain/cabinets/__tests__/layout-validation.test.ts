import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import { deriveDefaultRoomArchitecture } from "../../architecture/legacy-adapter";
import { validateRoomLayout, summarizeDesignReadiness } from "../layout-validation";
import { withCabinetWallPlacement } from "../wall-placement";

const ROOM = { width: 4000, height: 2400, depth: 3000 };
const arch = deriveDefaultRoomArchitecture(ROOM);
const south = arch.walls.find((w) => w.id === "wall:south")!;
south.openings.push({
  id: "d1",
  type: "door",
  offsetMm: 1200,
  widthMm: 900,
  heightMm: 2100,
});

function cab(
  id: string,
  offsetMm: number,
  widthMm = 600,
  heightMm = 720,
  parts: Cabinet["parts"] = [],
): Cabinet {
  return {
    id,
    roomId: "r",
    orgId: "o",
    type: "base",
    name: id,
    width: widthMm,
    height: heightMm,
    depth: 560,
    posX: 0,
    posY: 0,
    posZ: 0,
    parameters: withCabinetWallPlacement(
      {},
      { wallId: south.id, offsetMm, baseElevationMm: 0, facing: "into-room" },
    ),
    materialId: null,
    parts,
    createdAt: "",
    updatedAt: "",
  };
}

describe("validateRoomLayout", () => {
  it("clean chain → no issues", () => {
    const issues = validateRoomLayout({
      cabinets: [cab("a", 0), cab("b", 600)],
      architecture: { ...arch, walls: arch.walls.map((w) => ({ ...w, openings: [] })) },
    });
    expect(issues).toHaveLength(0);
  });

  it("overlap emits RUN_OVERLAP", () => {
    const issues = validateRoomLayout({
      cabinets: [cab("a", 0), cab("b", 400)],
      architecture: arch,
    });
    expect(issues.some((i) => i.code === "RUN_OVERLAP")).toBe(true);
  });

  it("large unassigned gap emits RUN_UNASSIGNED_GAP", () => {
    const issues = validateRoomLayout({
      cabinets: [cab("a", 0), cab("b", 3400)],
      architecture: { ...arch, walls: arch.walls.map((w) => ({ ...w, openings: [] })) },
    });
    expect(issues.some((i) => i.code === "RUN_UNASSIGNED_GAP")).toBe(true);
  });

  it("cabinet in front of a door emits CABINET_BLOCKS_OPENING", () => {
    // Door is at 1200..2100. Place cabinet at 1300..1900.
    const issues = validateRoomLayout({
      cabinets: [cab("blocks", 1300)],
      architecture: arch,
    });
    expect(issues.some((i) => i.code === "CABINET_BLOCKS_OPENING")).toBe(true);
  });

  it("cabinet extending past wall end emits CABINET_OUTSIDE_WALL", () => {
    const issues = validateRoomLayout({
      cabinets: [cab("spill", 3700)],
      architecture: { ...arch, walls: arch.walls.map((w) => ({ ...w, openings: [] })) },
    });
    expect(issues.some((i) => i.code === "CABINET_OUTSIDE_WALL")).toBe(true);
  });
});

describe("summarizeDesignReadiness", () => {
  it("counts runs + reports parts/material gaps", () => {
    const summary = summarizeDesignReadiness({
      cabinets: [cab("a", 0), cab("b", 600)],
      architecture: { ...arch, walls: arch.walls.map((w) => ({ ...w, openings: [] })) },
    });
    expect(summary.layout.runs).toBe(1);
    expect(summary.manufacturing.cabinetsMissingParts).toEqual(["a", "b"]);
    expect(summary.manufacturing.cabinetsMissingMaterial).toEqual(["a", "b"]);
  });
});
