// Unit conversion helpers.
//
// Manufacturing / domain code stores dimensions in MILLIMETERS.
// Three.js and other renderers work in METERS.
//
// These helpers are the single place conversions should happen — do not
// sprinkle `/ 1000`, `* 1000`, or `* Math.PI / 180` across the codebase.

export function mmToMeters(mm: number): number {
  return mm / 1000;
}

export function metersToMm(meters: number): number {
  return meters * 1000;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
