import { degreesToRadians, mmToMeters } from "../../util/units";
import type { SceneAssetDefinition, SceneAssetModelNormalization } from "./scene-asset-definition";

// Pure math for GLB / glTF normalization.
//
// Imported models arrive with arbitrary origin, unit scale, and
// orientation. Our catalog definitions declare authoritative dimensions
// in millimeters and require a bottom-center anchor. This helper computes
// the transform to bring the raw GLB into that convention.
//
// Kept in shared (no THREE dependency) so the math is testable and can be
// reused by non-browser consumers later (e.g. server-side previews).
//
// Convention:
//   · GLBs are typically authored in METERS.
//   · The returned transform is in METERS + RADIANS — Three.js input units.
//   · Definition dimensions in mm are converted at the boundary.

export interface RawBboxM {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface NormalizationTransform {
  /** Uniform scale multiplier (dimensionless). */
  scale: number;
  /** Translation in METERS, applied AFTER scale. */
  offsetMeters: { x: number; y: number; z: number };
  /** Rotation in RADIANS. Empty vector when no rotation was requested. */
  rotationRad: { x: number; y: number; z: number };
}

/**
 * Compute the transform to fit a raw GLB into the definition's catalog
 * envelope with bottom-center anchor at (0, 0, 0) in local model space.
 *
 * Steps:
 *   1. Compute uniform auto-fit scale so the raw bbox fits inside the
 *      catalog dimensions (limited by the tightest axis).
 *   2. Multiply by `definition.model.normalization.scale` if provided.
 *   3. Compute translation that centers X/Z on the origin and lifts the
 *      scaled bottom-Y to 0.
 *   4. Add `definition.model.normalization.offsetMm` (converted to meters).
 *   5. Rotation comes straight from `normalization.rotationDeg` (degrees →
 *      radians), applied in the local model frame.
 *
 * Returns identity for a zero-volume bbox (defensive; loader falls back to
 * primitive rendering in that case).
 */
export function computeNormalizationTransform(
  rawBbox: RawBboxM,
  definition: Pick<SceneAssetDefinition, "dimensionsMm" | "model">,
): NormalizationTransform {
  const rawW = rawBbox.max.x - rawBbox.min.x;
  const rawH = rawBbox.max.y - rawBbox.min.y;
  const rawD = rawBbox.max.z - rawBbox.min.z;

  const override = definition.model?.normalization ?? {};

  // Zero-volume defense: return identity so the loader can decide what
  // to do (usually: render primitive fallback and log a diagnostic).
  if (rawW <= 0 || rawH <= 0 || rawD <= 0) {
    return {
      scale: 1,
      offsetMeters: { x: 0, y: 0, z: 0 },
      rotationRad: normalizationRotationRad(override),
    };
  }

  const targetW = mmToMeters(definition.dimensionsMm.widthMm);
  const targetH = mmToMeters(definition.dimensionsMm.heightMm);
  const targetD = mmToMeters(definition.dimensionsMm.depthMm);

  const autoScale = Math.min(targetW / rawW, targetH / rawH, targetD / rawD);
  const scale = autoScale * (override.scale ?? 1);

  // Centering + floor-lift, computed on the scaled bbox.
  const scaledCenterX = ((rawBbox.min.x + rawBbox.max.x) / 2) * scale;
  const scaledCenterZ = ((rawBbox.min.z + rawBbox.max.z) / 2) * scale;
  const scaledMinY = rawBbox.min.y * scale;

  const userOffsetMeters = override.offsetMm
    ? {
        x: mmToMeters(override.offsetMm.x),
        y: mmToMeters(override.offsetMm.y),
        z: mmToMeters(override.offsetMm.z),
      }
    : { x: 0, y: 0, z: 0 };

  return {
    scale,
    offsetMeters: {
      x: -scaledCenterX + userOffsetMeters.x,
      y: -scaledMinY + userOffsetMeters.y,
      z: -scaledCenterZ + userOffsetMeters.z,
    },
    rotationRad: normalizationRotationRad(override),
  };
}

function normalizationRotationRad(
  override: SceneAssetModelNormalization,
): { x: number; y: number; z: number } {
  const r = override.rotationDeg;
  if (!r) return { x: 0, y: 0, z: 0 };
  return {
    x: degreesToRadians(r.x),
    y: degreesToRadians(r.y),
    z: degreesToRadians(r.z),
  };
}
