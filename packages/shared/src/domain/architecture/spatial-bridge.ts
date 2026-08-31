import type { SceneAssetDefinition } from "../sceneAssets/scene-asset-definition";
import type { SceneAssetInstance } from "../sceneAssets/scene-asset-instance";
import type { AABB, Vec3Mm } from "../sceneAssets/aabb";
import { aabbIntersects, getSceneAssetAabb } from "../sceneAssets/aabb";
import type { CompiledOpening, WallSegment } from "./wall-compiler";
import { compileWall } from "./wall-compiler";
import { wallLocalToWorld } from "./wall-math";
import type { RoomArchitecture, WallDefinition } from "./types";
import { extractFloorPolygon, pointInPolygon } from "./polygon";

// Scene-asset ↔ architecture spatial bridge.
//
// Extends the spatial-validation engine with warnings emitted from the
// `architecture` source. Openings (doors/windows/generic) are HOLES in the
// wall — an asset intersecting an opening region does NOT count as
// intersecting a solid wall; that's how furniture placed in an alcove
// stays warning-free.
//
// All math in millimeters. Returns issues (deterministic order); the
// consumer folds them into the room's Inspector spatial section.

export type ArchitectureSpatialCode =
  | "ASSET_INTERSECTS_WALL"
  | "ASSET_OUTSIDE_ROOM_FOOTPRINT";

export interface ArchitectureSpatialIssue {
  code: ArchitectureSpatialCode;
  severity: "warning";
  source: "architecture";
  message: string;
  wallId?: string;
}

/** World-space AABB of a compiled wall segment (with thickness). Used for
 *  broad-phase asset-vs-wall intersection checks. */
export function getWallSegmentAabb(
  wall: WallDefinition,
  segment: WallSegment,
): AABB {
  const frame = compileWall(wall).frame;
  const halfT = wall.thicknessMm / 2;

  // Corners in wall-local coords (Z spans -halfT..+halfT for the wall
  // centerline convention used by the domain).
  const corners: { xMm: number; yMm: number; zMm: number }[] = [
    { xMm: segment.xStartMm, yMm: segment.yBottomMm, zMm: -halfT },
    { xMm: segment.xEndMm, yMm: segment.yBottomMm, zMm: -halfT },
    { xMm: segment.xStartMm, yMm: segment.yTopMm, zMm: -halfT },
    { xMm: segment.xEndMm, yMm: segment.yTopMm, zMm: -halfT },
    { xMm: segment.xStartMm, yMm: segment.yBottomMm, zMm: halfT },
    { xMm: segment.xEndMm, yMm: segment.yBottomMm, zMm: halfT },
    { xMm: segment.xStartMm, yMm: segment.yTopMm, zMm: halfT },
    { xMm: segment.xEndMm, yMm: segment.yTopMm, zMm: halfT },
  ];

  const worldCorners = corners.map((c) => wallLocalToWorld(frame, c));
  return boundsOfWorldPoints(worldCorners);
}

/**
 * Detects scene-asset vs architecture conflicts:
 *   · asset AABB overlaps any SOLID wall segment (opening regions are
 *     silently allowed — they represent legal pass-through space)
 *   · asset AABB pokes outside the room's floor footprint (derived from
 *     the extremes of every wall's XZ endpoints)
 *
 * Returns [] when the placement is clean. Emits deterministic issues
 * ordered wall-by-wall then segment-by-segment.
 */
export function validateAssetAgainstArchitecture(input: {
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition;
  architecture: RoomArchitecture;
}): ArchitectureSpatialIssue[] {
  const { instance, definition, architecture } = input;
  const issues: ArchitectureSpatialIssue[] = [];

  const assetAabb = getSceneAssetAabb(instance, definition);

  for (const wall of architecture.walls) {
    const compiled = compileWall(wall);
    for (const segment of compiled.segments) {
      const wallAabb = getWallSegmentAabb(wall, segment);
      if (aabbIntersects(assetAabb, wallAabb)) {
        issues.push({
          code: "ASSET_INTERSECTS_WALL",
          severity: "warning",
          source: "architecture",
          wallId: wall.id,
          message: `Asset intersects wall "${wall.id}".`,
        });
        // One report per wall is enough — extra segments of the same wall
        // don't add information for the user.
        break;
      }
    }
  }

  // Room footprint: polygon containment. For legacy rectangular rooms
  // this is exactly equivalent to the AABB check. For custom polygons
  // (custom architecture mode) it catches assets placed in concavities /
  // outside irregular walls. Sampling the four XZ corners of the asset
  // AABB is a broad-phase check — good enough to flag obvious violations
  // without doing full polygon-polygon intersection.
  const polygon = extractFloorPolygon(architecture);
  if (polygon) {
    const cornersXZ = [
      { x: assetAabb.min.x, z: assetAabb.min.z },
      { x: assetAabb.max.x, z: assetAabb.min.z },
      { x: assetAabb.min.x, z: assetAabb.max.z },
      { x: assetAabb.max.x, z: assetAabb.max.z },
    ];
    if (cornersXZ.some((c) => !pointInPolygon(c, polygon))) {
      issues.push({
        code: "ASSET_OUTSIDE_ROOM_FOOTPRINT",
        severity: "warning",
        source: "architecture",
        message: "Asset extends outside the room's floor footprint.",
      });
    }
  }

  return issues;
}

/** Rectangular XZ bounds of the wall polygon. Returns null when there
 *  are no walls. */
export function getRoomFloorFootprint(
  architecture: RoomArchitecture,
): { min: { x: number; z: number }; max: { x: number; z: number } } | null {
  if (architecture.walls.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const wall of architecture.walls) {
    for (const p of [wall.startMm, wall.endMm]) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  return { min: { x: minX, z: minZ }, max: { x: maxX, z: maxZ } };
}

// ── Internals ──────────────────────────────────────────────────────────

function boundsOfWorldPoints(
  points: readonly { x: number; y: number; z: number }[],
): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
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

// Compiled openings are exported by the compiler; provide them via
// re-export for consumers that want a single import surface.
export type { CompiledOpening, Vec3Mm };
