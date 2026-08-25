import type { MaterialGrainDirection } from "@woodcraft/shared";

// Basic UV / repeat helpers.
//
// The MVP treats every face as an axis-aligned rectangle with dimensions
// in millimeters. We derive `Texture.repeat.set(u, v)` by dividing the
// face's real-world size by the material's `scaleMm`. Grain direction
// swaps U/V so wood-grain textures run the correct way.

export interface FaceSizeMm {
  widthMm: number;
  heightMm: number;
}

export interface UVRepeat {
  u: number;
  v: number;
}

const MIN_REPEAT = 0.05;
const MAX_REPEAT = 40;

/**
 * Compute a Three.js `texture.repeat` pair for a face rendered with a
 * tile at a real-world scale.
 *
 * When `scaleMm` is 0 or missing (solid-color materials), returns (1, 1).
 * When the grain runs horizontal, U and V are swapped so the texture's
 * long axis aligns with the face's width.
 */
export function computeRepeat(
  face: FaceSizeMm,
  scaleMm: number | undefined,
  grain?: MaterialGrainDirection,
): UVRepeat {
  if (!scaleMm || scaleMm <= 0) return { u: 1, v: 1 };
  const rawU = face.widthMm / scaleMm;
  const rawV = face.heightMm / scaleMm;
  const u = clamp(rawU);
  const v = clamp(rawV);
  if (grain === "horizontal") return { u: v, v: u };
  return { u, v };
}

function clamp(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  if (x < MIN_REPEAT) return MIN_REPEAT;
  if (x > MAX_REPEAT) return MAX_REPEAT;
  // Round to 3 decimals — avoids floating jitter across renders.
  return Math.round(x * 1000) / 1000;
}
