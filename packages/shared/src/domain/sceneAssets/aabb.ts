import type { SceneAssetDefinition } from "./scene-asset-definition";
import type { SceneAssetInstance, Vec3 } from "./scene-asset-instance";
import { IDENTITY_SCALE } from "./scene-asset-instance";

// Axis-Aligned Bounding Box in DOMAIN space (millimeters).
//
// Used by the spatial-validation engine to detect out-of-bounds placement
// and asset ↔ asset overlap. Values are ALWAYS millimeters — never mixed
// with the renderer's meters. Callers converting to Three.js use the
// existing `mmToMeters` helper at the render boundary.

export type Vec3Mm = Vec3;

export interface AABB {
  min: Vec3Mm;
  max: Vec3Mm;
}

/**
 * Applies full XYZ Euler rotation (Three.js default order) to a point.
 * Kept as a plain math helper — no THREE dependency here so the module
 * stays browser-agnostic.
 */
function rotatePoint(p: Vec3Mm, rotationDeg: Vec3Mm): Vec3Mm {
  const rx = (rotationDeg.x * Math.PI) / 180;
  const ry = (rotationDeg.y * Math.PI) / 180;
  const rz = (rotationDeg.z * Math.PI) / 180;

  let { x, y, z } = p;

  // X rotation
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  {
    const ny = y * cx - z * sx;
    const nz = y * sx + z * cx;
    y = ny;
    z = nz;
  }

  // Y rotation
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  {
    const nx = x * cy + z * sy;
    const nz = -x * sy + z * cy;
    x = nx;
    z = nz;
  }

  // Z rotation
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  {
    const nx = x * cz - y * sz;
    const ny = x * sz + y * cz;
    x = nx;
    y = ny;
  }

  return { x, y, z };
}

/**
 * Corners of a Scene Asset in local (bottom-center-anchored) space,
 * PRE-SCALED per-axis so the caller can rotate + translate a single
 * point cloud that already reflects the instance's actual size. Order
 * is deterministic so tests can assert individual corners.
 */
function localCorners(
  dimensions: SceneAssetDefinition["dimensionsMm"],
  scale: Vec3,
): Vec3Mm[] {
  const halfW = (dimensions.widthMm * scale.x) / 2;
  const halfD = (dimensions.depthMm * scale.z) / 2;
  const h = dimensions.heightMm * scale.y;
  return [
    { x: -halfW, y: 0, z: -halfD }, // 0: front-left-bottom (relative)
    { x: +halfW, y: 0, z: -halfD },
    { x: -halfW, y: 0, z: +halfD },
    { x: +halfW, y: 0, z: +halfD },
    { x: -halfW, y: h, z: -halfD },
    { x: +halfW, y: h, z: -halfD },
    { x: -halfW, y: h, z: +halfD },
    { x: +halfW, y: h, z: +halfD }, // 7: back-right-top
  ];
}

function boundsOfPoints(points: readonly Vec3Mm[]): AABB {
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

/**
 * Returns the world-space AABB of a Scene Asset given its catalog
 * dimensions, instance transform, and per-axis scale multipliers.
 * Accounts for full XYZ Euler rotation.
 *
 * `instance.scale` is optional so legacy serialized rows that never
 * carried a scale value default to identity (matching the Prisma
 * column default of 1). This keeps the collision path safe for the
 * back-compat case without special-casing it at every call site.
 *
 * The AABB is a conservative volume: it wraps every rotated corner of
 * the SCALED envelope, so it may report more space occupied than the
 * model actually fills. That's the correct trade-off for a broad-phase
 * collision system.
 */
export function getSceneAssetAabb(
  instance: Pick<SceneAssetInstance, "positionMm" | "rotationDeg"> & { scale?: Vec3 },
  definition: Pick<SceneAssetDefinition, "dimensionsMm">,
): AABB {
  const scale = instance.scale ?? IDENTITY_SCALE;
  const local = localCorners(definition.dimensionsMm, scale);
  const rotated = local.map((p) => rotatePoint(p, instance.rotationDeg));
  const translated = rotated.map((p) => ({
    x: p.x + instance.positionMm.x,
    y: p.y + instance.positionMm.y,
    z: p.z + instance.positionMm.z,
  }));
  return boundsOfPoints(translated);
}

/**
 * Returns the world-space CLEARANCE AABB — the SCALED catalog envelope
 * expanded by the definition's `collision.clearance*Mm` values, then
 * rotated / translated into world space. Expansion is applied in local
 * coordinates, so "front clearance" is always relative to the asset's
 * facing direction (+Z in local), not the world +Z axis.
 *
 * Clearance values are treated as ABSOLUTE millimeters (not scaled). A
 * fridge stretched visually still needs the same authored door-swing
 * clearance from the manufacturer spec — scaling clearance would silently
 * shrink safety margins and is intentionally NOT done here.
 *
 * Returns the plain AABB when collision metadata is disabled or absent.
 */
export function getSceneAssetClearanceAabb(
  instance: Pick<SceneAssetInstance, "positionMm" | "rotationDeg"> & { scale?: Vec3 },
  definition: Pick<SceneAssetDefinition, "dimensionsMm" | "collision">,
): AABB {
  const coll = definition.collision;
  if (!coll || !coll.enabled) {
    return getSceneAssetAabb(instance, definition);
  }

  const scale = instance.scale ?? IDENTITY_SCALE;
  const halfW = (definition.dimensionsMm.widthMm * scale.x) / 2;
  const halfD = (definition.dimensionsMm.depthMm * scale.z) / 2;
  const h = definition.dimensionsMm.heightMm * scale.y;

  // Local frame convention: +X = right, -X = left, +Z = front, -Z = back
  const cLeft = coll.clearanceLeftMm ?? 0;
  const cRight = coll.clearanceRightMm ?? 0;
  const cFront = coll.clearanceFrontMm ?? 0;
  const cBack = coll.clearanceBackMm ?? 0;
  const cTop = coll.clearanceTopMm ?? 0;

  const expandedLocal: Vec3Mm[] = [
    { x: -halfW - cLeft, y: 0, z: -halfD - cBack },
    { x: +halfW + cRight, y: 0, z: -halfD - cBack },
    { x: -halfW - cLeft, y: 0, z: +halfD + cFront },
    { x: +halfW + cRight, y: 0, z: +halfD + cFront },
    { x: -halfW - cLeft, y: h + cTop, z: -halfD - cBack },
    { x: +halfW + cRight, y: h + cTop, z: -halfD - cBack },
    { x: -halfW - cLeft, y: h + cTop, z: +halfD + cFront },
    { x: +halfW + cRight, y: h + cTop, z: +halfD + cFront },
  ];

  const rotated = expandedLocal.map((p) => rotatePoint(p, instance.rotationDeg));
  const translated = rotated.map((p) => ({
    x: p.x + instance.positionMm.x,
    y: p.y + instance.positionMm.y,
    z: p.z + instance.positionMm.z,
  }));
  return boundsOfPoints(translated);
}

/** True when two AABBs share any interior volume (strict inequality — a
 *  touching face is NOT considered a collision). */
export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.max.x > b.min.x &&
    a.min.x < b.max.x &&
    a.max.y > b.min.y &&
    a.min.y < b.max.y &&
    a.max.z > b.min.z &&
    a.min.z < b.max.z
  );
}

/** Returns the AABB expanded by `mm` on all sides. Useful for building
 *  clearance envelopes without going through the rotation path. */
export function inflateAabb(a: AABB, mm: number): AABB {
  return {
    min: { x: a.min.x - mm, y: a.min.y - mm, z: a.min.z - mm },
    max: { x: a.max.x + mm, y: a.max.y + mm, z: a.max.z + mm },
  };
}
