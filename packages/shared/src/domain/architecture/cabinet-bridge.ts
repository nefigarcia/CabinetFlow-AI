import type { Cabinet } from "../../types/cabinet";
import type { SceneAssetDefinition } from "../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../sceneAssets/scene-asset-instance";
import { aabbIntersects, getSceneAssetAabb, type AABB } from "../sceneAssets/aabb";
import { compileWall } from "./wall-compiler";
import type { CompiledOpening } from "./wall-compiler";
import { getWallSegmentAabb } from "./spatial-bridge";
import type { RoomArchitecture, WallDefinition } from "./types";
import { wallLocalToWorld } from "./wall-math";

// Cabinet ↔ scene-asset + cabinet ↔ architecture spatial bridges.
//
// Emits WARNINGS ONLY. Never blocks the user; never mutates manufacturing
// geometry. Cabinet AABBs are computed from the cabinet's persisted
// posX/posY/posZ + width/height/depth (millimeters) which are the same
// values the current renderer consumes.
//
// Convention: `posX/posY/posZ` are the cabinet's MIN corner (bottom-back-
// left) — matches the renderer's group-position + inside-mesh layout.
// This is a slight approximation for edge cases (rotated cabinets) but
// broad-phase warnings do not need triangle-level accuracy.

export type CabinetBridgeIssueCode =
  | "SCENE_ASSET_OVERLAPS_CABINET"
  | "CABINET_OVERLAPS_OPENING";

export interface CabinetBridgeIssue {
  code: CabinetBridgeIssueCode;
  severity: "warning";
  /** Cabinet bridge issues use their own source so they can be filtered
   *  separately from `scene` / `architecture` / `manufacturing`. */
  source: "cabinet";
  message: string;
  cabinetId?: string;
  wallId?: string;
  openingId?: string;
  sceneAssetInstanceId?: string;
}

/** World-space AABB of a cabinet (millimeters). */
export function getCabinetAabb(cabinet: Pick<Cabinet, "posX" | "posY" | "posZ" | "width" | "height" | "depth">): AABB {
  const x = Number(cabinet.posX);
  const y = Number(cabinet.posY);
  const z = Number(cabinet.posZ);
  const w = Number(cabinet.width);
  const h = Number(cabinet.height);
  const d = Number(cabinet.depth);
  return {
    min: { x, y, z },
    max: { x: x + w, y: y + h, z: z + d },
  };
}

/**
 * Emits a warning for each scene-asset ↔ cabinet AABB overlap.
 * `instances` is scoped to the current room (caller filters).
 */
export function detectSceneAssetVsCabinet(input: {
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition;
  cabinets: readonly Cabinet[];
}): CabinetBridgeIssue[] {
  const { instance, definition, cabinets } = input;
  const issues: CabinetBridgeIssue[] = [];

  const assetAabb = getSceneAssetAabb(instance, definition);

  for (const cabinet of cabinets) {
    const cabAabb = getCabinetAabb(cabinet);
    if (aabbIntersects(assetAabb, cabAabb)) {
      issues.push({
        code: "SCENE_ASSET_OVERLAPS_CABINET",
        severity: "warning",
        source: "cabinet",
        cabinetId: cabinet.id,
        sceneAssetInstanceId: instance.id,
        message: `Asset overlaps cabinet "${cabinet.name}".`,
      });
    }
  }

  return issues;
}

/**
 * Emits a warning for each cabinet ↔ opening (door/window/generic) overlap.
 * The wall's OPENING AABB is a solid-box representation of the hole (not
 * the missing space); a cabinet overlapping that region is likely
 * blocking a door or crossing a window.
 */
export function detectCabinetsVsOpenings(input: {
  cabinets: readonly Cabinet[];
  architecture: RoomArchitecture;
}): CabinetBridgeIssue[] {
  const { cabinets, architecture } = input;
  const issues: CabinetBridgeIssue[] = [];

  for (const wall of architecture.walls) {
    const compiled = compileWall(wall);
    for (const opening of compiled.openings) {
      const openingAabb = getOpeningWorldAabb(wall, opening);
      for (const cabinet of cabinets) {
        const cabAabb = getCabinetAabb(cabinet);
        if (aabbIntersects(openingAabb, cabAabb)) {
          issues.push({
            code: "CABINET_OVERLAPS_OPENING",
            severity: "warning",
            source: "cabinet",
            cabinetId: cabinet.id,
            wallId: wall.id,
            openingId: opening.openingId,
            message: `Cabinet "${cabinet.name}" overlaps ${opening.type} "${opening.openingId}" on wall "${wall.id}".`,
          });
        }
      }
    }
  }

  return issues;
}

/** World-space AABB of a compiled opening region on a wall. */
function getOpeningWorldAabb(wall: WallDefinition, opening: CompiledOpening): AABB {
  const halfT = wall.thicknessMm / 2;
  const frame = compileWall(wall).frame;
  const corners = [
    { xMm: opening.xStartMm, yMm: opening.yBottomMm, zMm: -halfT },
    { xMm: opening.xEndMm, yMm: opening.yBottomMm, zMm: -halfT },
    { xMm: opening.xStartMm, yMm: opening.yTopMm, zMm: -halfT },
    { xMm: opening.xEndMm, yMm: opening.yTopMm, zMm: -halfT },
    { xMm: opening.xStartMm, yMm: opening.yBottomMm, zMm: halfT },
    { xMm: opening.xEndMm, yMm: opening.yBottomMm, zMm: halfT },
    { xMm: opening.xStartMm, yMm: opening.yTopMm, zMm: halfT },
    { xMm: opening.xEndMm, yMm: opening.yTopMm, zMm: halfT },
  ];
  const worldCorners = corners.map((c) => wallLocalToWorld(frame, c));
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of worldCorners) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

// Silence unused import — `getWallSegmentAabb` is exported for callers
// that want to run their own asset-vs-wall checks without going through
// `detectSceneAssetVsCabinet`.
void getWallSegmentAabb;
