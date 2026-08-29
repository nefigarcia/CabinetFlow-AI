import type { Cabinet } from "../../types/cabinet";
import type { RoomArchitecture, WallOpening } from "../architecture/types";
import type { SceneAssetDefinition } from "../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../sceneAssets/scene-asset-instance";
import type { CabinetRun } from "./cabinet-run";
import {
  buildCabinetRuns,
  detectRunGaps,
  detectRunOverlaps,
  getApplianceExtentsOnWall,
  getRemainingWallSpace,
} from "./cabinet-run";
import { getWallLengthMm } from "../architecture/wall-math";

// Layout validation — deterministic warnings across a room's cabinet
// runs. Distinct from MANUFACTURING validation (parts, joinery,
// materials) which stays in the existing cabinet validator + AI report.
//
// Every issue carries `source: "layout"` so the UI can present them next
// to (never mixed with) manufacturing findings.

export type LayoutIssueCode =
  | "RUN_OVERLAP"
  | "RUN_UNASSIGNED_GAP"
  | "RUN_EXCEEDS_WALL"
  | "CABINET_OUTSIDE_WALL"
  | "CABINET_BLOCKS_OPENING";

export interface LayoutIssue {
  code: LayoutIssueCode;
  severity: "warning";
  source: "layout";
  wallId?: string;
  cabinetId?: string;
  message: string;
}

export function validateRoomLayout(input: {
  cabinets: Cabinet[];
  architecture: RoomArchitecture;
  sceneAssets?: readonly {
    instance: SceneAssetInstance;
    definition: SceneAssetDefinition;
  }[];
}): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const runs = buildCabinetRuns({
    cabinets: input.cabinets,
    walls: input.architecture.walls,
  });
  for (const run of runs) {
    issues.push(...validateRun({ run, sceneAssets: input.sceneAssets ?? [] }));
  }
  return issues;
}

function validateRun(input: {
  run: CabinetRun;
  sceneAssets: readonly {
    instance: SceneAssetInstance;
    definition: SceneAssetDefinition;
  }[];
}): LayoutIssue[] {
  const out: LayoutIssue[] = [];
  const run = input.run;
  const wallLen = getWallLengthMm(run.wall);
  const openings = run.wall.openings;
  const appliances = getApplianceExtentsOnWall({
    wall: run.wall,
    sceneAssets: input.sceneAssets,
  });

  // Overlaps
  for (const ov of detectRunOverlaps(run)) {
    out.push({
      code: "RUN_OVERLAP",
      severity: "warning",
      source: "layout",
      wallId: run.wallId,
      cabinetId: ov.aCabinetId,
      message: `Cabinets "${ov.aCabinetId}" and "${ov.bCabinetId}" overlap by ${ov.widthMm.toFixed(1)} mm on wall "${run.wallId}".`,
    });
  }

  // Unassigned gaps
  for (const g of detectRunGaps({ run, openings, applianceExtents: appliances })) {
    if (g.kind === "unassigned") {
      out.push({
        code: "RUN_UNASSIGNED_GAP",
        severity: "warning",
        source: "layout",
        wallId: run.wallId,
        message: `Unassigned gap of ${g.widthMm.toFixed(0)} mm on wall "${run.wallId}" (${g.startMm.toFixed(0)}–${g.endMm.toFixed(0)} mm). Add a filler or mark it intentional (opening/appliance).`,
      });
    }
  }

  // Cabinet outside wall
  for (const item of run.items) {
    const left = item.placement.offsetMm;
    const right = item.rightEdgeMm;
    if (left < -0.5 || right > wallLen + 0.5) {
      out.push({
        code: "CABINET_OUTSIDE_WALL",
        severity: "warning",
        source: "layout",
        wallId: run.wallId,
        cabinetId: item.cabinetId,
        message: `Cabinet "${item.cabinetId}" extends outside wall "${run.wallId}" (${left.toFixed(0)}–${right.toFixed(0)} mm; wall length ${wallLen.toFixed(0)} mm).`,
      });
    }
  }

  // Cabinet blocks opening — cabinet's [left,right] overlaps opening's
  // [offsetMm, offsetMm+widthMm] AND the cabinet's vertical span crosses
  // the opening's vertical span.
  for (const item of run.items) {
    const cabBot = item.placement.baseElevationMm;
    const cabTop = cabBot + Number(item.cabinet.height);
    for (const op of openings) {
      const opLeft = op.offsetMm;
      const opRight = op.offsetMm + op.widthMm;
      const overlapX = Math.min(item.rightEdgeMm, opRight) - Math.max(item.placement.offsetMm, opLeft);
      if (overlapX <= 0.5) continue;
      const opBot = op.type === "door" ? 0 : op.type === "window" ? op.sillHeightMm : (op.sillHeightMm ?? 0);
      const opTop = opBot + op.heightMm;
      const overlapY = Math.min(cabTop, opTop) - Math.max(cabBot, opBot);
      if (overlapY <= 0.5) continue;
      out.push({
        code: "CABINET_BLOCKS_OPENING",
        severity: "warning",
        source: "layout",
        wallId: run.wallId,
        cabinetId: item.cabinetId,
        message: `Cabinet "${item.cabinetId}" overlaps opening "${op.id}" on wall "${run.wallId}".`,
      });
    }
  }

  // Global overshoot — run extent exceeds wall.
  const remaining = getRemainingWallSpace({
    wall: run.wall,
    run,
    openings,
    applianceExtents: appliances,
  });
  if (remaining.remainingMm < -0.5) {
    out.push({
      code: "RUN_EXCEEDS_WALL",
      severity: "warning",
      source: "layout",
      wallId: run.wallId,
      message: `Wall "${run.wallId}" run exceeds available span by ${Math.abs(remaining.remainingMm).toFixed(0)} mm.`,
    });
  }

  return out;
}

// ─── Design readiness summary ───────────────────────────────────────────

export interface DesignReadiness {
  layout: {
    runs: number;
    overlaps: number;
    unassignedGaps: number;
    openingConflicts: number;
    exceedsWall: boolean;
    totalRemainingMm: number;
  };
  manufacturing: {
    /** Cabinet ids with 0 parts (compilation not yet run OR failed). */
    cabinetsMissingParts: string[];
    /** Cabinet ids without a resolved materialId. */
    cabinetsMissingMaterial: string[];
  };
}

export function summarizeDesignReadiness(input: {
  cabinets: Cabinet[];
  architecture: RoomArchitecture;
  sceneAssets?: readonly {
    instance: SceneAssetInstance;
    definition: SceneAssetDefinition;
  }[];
}): DesignReadiness {
  const runs = buildCabinetRuns({
    cabinets: input.cabinets,
    walls: input.architecture.walls,
  });
  let overlaps = 0;
  let unassignedGaps = 0;
  let openingConflicts = 0;
  let exceedsWall = false;
  let totalRemainingMm = 0;
  const issues = validateRoomLayout(input);
  for (const i of issues) {
    if (i.code === "RUN_OVERLAP") overlaps++;
    if (i.code === "RUN_UNASSIGNED_GAP") unassignedGaps++;
    if (i.code === "CABINET_BLOCKS_OPENING") openingConflicts++;
    if (i.code === "RUN_EXCEEDS_WALL") exceedsWall = true;
  }
  for (const run of runs) {
    totalRemainingMm += getRemainingWallSpace({
      wall: run.wall,
      run,
      openings: run.wall.openings,
      applianceExtents: getApplianceExtentsOnWall({
        wall: run.wall,
        sceneAssets: input.sceneAssets ?? [],
      }),
    }).remainingMm;
  }
  return {
    layout: {
      runs: runs.length,
      overlaps,
      unassignedGaps,
      openingConflicts,
      exceedsWall,
      totalRemainingMm,
    },
    manufacturing: {
      cabinetsMissingParts: input.cabinets.filter((c) => c.parts.length === 0).map((c) => c.id),
      cabinetsMissingMaterial: input.cabinets.filter((c) => !c.materialId).map((c) => c.id),
    },
  };
}
