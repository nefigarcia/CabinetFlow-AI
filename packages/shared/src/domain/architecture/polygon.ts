import type { RoomArchitecture, Vec2Mm, WallDefinition } from "./types";

// Floor-plan polygon math for the Room Architecture Engine.
//
// The "floor polygon" is the closed 2D contour formed by walking the walls
// in order and taking their start points. For legacy rectangular rooms
// (LEGACY_WALL_IDS south → east → north → west) the polygon is a well-
// defined 4-point rectangle. For custom-drawn architectures the polygon
// tracks whatever the user has authored — see `polygonWinding` and
// `polygonSelfIntersects` for topology sanity checks.
//
// Coordinates are millimeters, matching the rest of the architecture
// domain. Y is dropped (top-down view).

export interface FloorPolygon {
  /** Ordered polygon vertices. First vertex is not repeated at the end. */
  pointsMm: Vec2Mm[];
}

const EPS_MM = 1e-3;

/** Ordered polygon from wall start points. Returns null when there are
 *  fewer than 3 walls (no valid closed shape). */
export function extractFloorPolygon(architecture: RoomArchitecture): FloorPolygon | null {
  if (architecture.walls.length < 3) return null;
  return { pointsMm: architecture.walls.map((w) => ({ ...w.startMm })) };
}

/** True if `p` lies strictly inside the polygon (or on the boundary — we
 *  use the standard ray-cast which counts boundary points as inside for
 *  half of the tie edges; that's acceptable for our warning-only use). */
export function pointInPolygon(p: Vec2Mm, polygon: FloorPolygon): boolean {
  const pts = polygon.pointsMm;
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const intersects =
      pi.z > p.z !== pj.z > p.z &&
      p.x < ((pj.x - pi.x) * (p.z - pi.z)) / (pj.z - pi.z + Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Signed 2× polygon area in the XZ plane. Positive → CCW winding (right-
 *  hand normals point INTO the polygon in our coordinate convention).
 *  Negative → CW. The magnitude is 2× the polygon area (unsigned). */
export function polygonSignedArea2(polygon: FloorPolygon): number {
  const pts = polygon.pointsMm;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.z - b.x * a.z;
  }
  return s;
}

export type PolygonWinding = "ccw" | "cw" | "degenerate";

export function polygonWinding(polygon: FloorPolygon): PolygonWinding {
  const s = polygonSignedArea2(polygon);
  if (Math.abs(s) < EPS_MM) return "degenerate";
  return s > 0 ? "ccw" : "cw";
}

/** True if two closed segments (a1,a2) and (b1,b2) share a proper
 *  crossing (not just touching at a shared endpoint). Used by topology
 *  self-intersection detection — adjacent edges are excluded by callers. */
export function segmentsCrossProperly(
  a1: Vec2Mm,
  a2: Vec2Mm,
  b1: Vec2Mm,
  b2: Vec2Mm,
): boolean {
  const d1 = orient(b1, b2, a1);
  const d2 = orient(b1, b2, a2);
  const d3 = orient(a1, a2, b1);
  const d4 = orient(a1, a2, b2);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

function orient(p: Vec2Mm, q: Vec2Mm, r: Vec2Mm): number {
  return (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
}

/** Returns any pair (i, j) of edge indices whose segments cross properly.
 *  Empty array when the polygon has no self-intersections. Adjacent edges
 *  (sharing an endpoint) are excluded. */
export function polygonSelfIntersections(polygon: FloorPolygon): Array<[number, number]> {
  const pts = polygon.pointsMm;
  const n = pts.length;
  const out: Array<[number, number]> = [];
  if (n < 4) return out;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i]!;
    const a2 = pts[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      // Skip the wrap-around edge that neighbors edge i.
      if (i === 0 && j === n - 1) continue;
      const b1 = pts[j]!;
      const b2 = pts[(j + 1) % n]!;
      if (segmentsCrossProperly(a1, a2, b1, b2)) out.push([i, j]);
    }
  }
  return out;
}

/** Simple triangulation via fan from the first vertex. Correct for convex
 *  polygons AND legacy rectangles. Non-convex custom polygons may produce
 *  degenerate triangles — acceptable for the MVP renderer which uses the
 *  triangles for a flat mesh (invisible from below when winding is wrong).
 *  A proper ear-clipping pass can replace this later without changing the
 *  interface. */
export function triangulatePolygonFan(polygon: FloorPolygon): Array<[Vec2Mm, Vec2Mm, Vec2Mm]> {
  const pts = polygon.pointsMm;
  if (pts.length < 3) return [];
  const anchor = pts[0]!;
  const out: Array<[Vec2Mm, Vec2Mm, Vec2Mm]> = [];
  for (let i = 1; i < pts.length - 1; i++) {
    out.push([anchor, pts[i]!, pts[i + 1]!]);
  }
  return out;
}

/** AABB of the polygon vertices (millimeters). */
export function polygonAabb(polygon: FloorPolygon): {
  min: Vec2Mm;
  max: Vec2Mm;
} | null {
  const pts = polygon.pointsMm;
  if (pts.length === 0) return null;
  let minX = pts[0]!.x;
  let maxX = pts[0]!.x;
  let minZ = pts[0]!.z;
  let maxZ = pts[0]!.z;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { min: { x: minX, z: minZ }, max: { x: maxX, z: maxZ } };
}

/** Endpoint continuity gap between consecutive walls. Returns the distance
 *  from wall[i].end to wall[i+1].start (wraps at end). Zero when perfectly
 *  contiguous. */
export function endpointGaps(walls: WallDefinition[]): number[] {
  const n = walls.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = walls[i]!.endMm;
    const b = walls[(i + 1) % n]!.startMm;
    out.push(Math.hypot(b.x - a.x, b.z - a.z));
  }
  return out;
}
