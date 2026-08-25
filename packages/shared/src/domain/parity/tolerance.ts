// Tolerance policy for geometry parity comparison.
//
// Cabinet manufacturing tolerances are usually specified around ±0.5 mm for
// panel cuts (Blum, HOLZ-HER, Biesse machine specs). For PARITY COMPARISON
// however we want a much tighter tolerance — because the goal here is to
// detect DIVERGENCE between the TypeScript and Python implementations, not
// to hide it. A 0.01 mm tolerance catches everything except floating-point
// jitter from unit conversions or intermediate calculations.
//
// This tolerance is a PARITY tolerance only. It has no bearing on production
// machining tolerances and MUST NOT be used elsewhere. When the deterministic
// validation engine lands in V2.3, it will define its own tolerance policy.

/** Maximum absolute delta at which two geometry values are considered equal. */
export const GEOMETRY_COMPARE_TOLERANCE_MM = 0.01;

/**
 * Ratio delta tolerance used when comparing derived ratios (e.g. drawer zone
 * fractional height). Ratios are dimensionless; a 0.0001 tolerance catches
 * genuine mismatches while ignoring floating point noise.
 */
export const RATIO_COMPARE_TOLERANCE = 0.0001;

export function nearlyEqualMm(a: number, b: number): boolean {
  return Math.abs(a - b) <= GEOMETRY_COMPARE_TOLERANCE_MM;
}

export function nearlyEqualRatio(a: number, b: number): boolean {
  return Math.abs(a - b) <= RATIO_COMPARE_TOLERANCE;
}

export function deltaMm(a: number, b: number): number {
  return Math.round((b - a) * 1000) / 1000;
}
