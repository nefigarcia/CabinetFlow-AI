import type {
  RoomArchitecture,
  WallDefinition,
  WallOpening,
  WallOpeningType,
} from "./types";
import { getWallFrame, type WallFrame } from "./wall-math";

// Deterministic wall geometry compiler.
//
// Input:  a WallDefinition (start/end + height + thickness + openings).
// Output: a list of SOLID RECTANGULAR SEGMENTS in wall-local coordinates.
//
// Wall-local X = along wall from start toward end (0 .. wall.lengthMm).
// Wall-local Y = vertical (0 = floor, height = ceiling).
//
// The compiler expresses the solid parts of a wall as a union of
// non-overlapping rectangles — no boolean subtraction at render time.
// This is the domain-authoritative representation; the renderer converts
// each rectangle to a THREE.BoxGeometry (with the wall's thickness as its
// depth) and places it via `wallLocalToWorld`.
//
// Openings are clipped to the wall bounds — invalid or off-wall inputs
// produce no segments for their region (validation is separate).

/** One solid rectangular piece of a wall in wall-local coordinates. */
export interface WallSegment {
  /** Which wall this segment belongs to (parent wall id). */
  wallId: string;
  /** Left edge of the segment along the wall (mm). */
  xStartMm: number;
  /** Right edge along the wall (mm). */
  xEndMm: number;
  /** Bottom edge above floor (mm). */
  yBottomMm: number;
  /** Top edge above floor (mm). */
  yTopMm: number;
}

/** Compiled projection of an opening — used by the renderer to draw the
 *  frame outline / door swing arc / window mullion overlay. */
export interface CompiledOpening {
  wallId: string;
  openingId: string;
  type: WallOpeningType;
  xStartMm: number;
  xEndMm: number;
  yBottomMm: number;
  yTopMm: number;
}

/** Full compiled output for one wall. */
export interface CompiledWall {
  wallId: string;
  frame: WallFrame;
  heightMm: number;
  thicknessMm: number;
  segments: WallSegment[];
  openings: CompiledOpening[];
}

/** Y-band for one opening: [yBottom, yTop]. Used internally. */
interface OpeningYBand {
  xStartMm: number;
  xEndMm: number;
  yBottomMm: number;
  yTopMm: number;
}

/** Reads sill height for any opening kind. Doors have implicit sill 0. */
function sillHeightMm(opening: WallOpening): number {
  if (opening.type === "door") return 0;
  if (opening.type === "window") return opening.sillHeightMm;
  return opening.sillHeightMm ?? 0;
}

/** Clip [xa, xb] to [0, wallLength]. Returns null if fully outside. */
function clipX(
  xa: number,
  xb: number,
  wallLengthMm: number,
): [number, number] | null {
  const a = Math.max(0, Math.min(xa, xb));
  const b = Math.min(wallLengthMm, Math.max(xa, xb));
  if (b <= a) return null;
  return [a, b];
}

/** Clip [ya, yb] to [0, wallHeight]. Returns null if fully outside. */
function clipY(
  ya: number,
  yb: number,
  wallHeightMm: number,
): [number, number] | null {
  const a = Math.max(0, Math.min(ya, yb));
  const b = Math.min(wallHeightMm, Math.max(ya, yb));
  if (b <= a) return null;
  return [a, b];
}

/**
 * Compiles a single wall into a list of non-overlapping SOLID rectangles
 * in wall-local coordinates. The strategy is a sweep along the wall's X:
 *
 *   1. Collect every opening's clipped X band + Y band.
 *   2. Sort openings by xStart. Merge horizontal ranges that touch.
 *   3. Between consecutive merged X ranges, emit a full-height solid
 *      segment.
 *   4. Within each merged X range, emit the "above" and "below" bands
 *      that remain solid (the parts of the wall the opening doesn't
 *      punch through).
 *
 * The compiler NEVER mutates its inputs.
 */
export function compileWall(wall: WallDefinition): CompiledWall {
  const frame = getWallFrame(wall);
  const wallLengthMm = frame.lengthMm;
  const wallHeightMm = wall.heightMm;

  const compiledOpenings: CompiledOpening[] = [];
  const bands: OpeningYBand[] = [];

  for (const opening of wall.openings) {
    const xRange = clipX(
      opening.offsetMm,
      opening.offsetMm + opening.widthMm,
      wallLengthMm,
    );
    if (!xRange) continue;

    const yBottomRaw = sillHeightMm(opening);
    const yTopRaw = yBottomRaw + opening.heightMm;
    const yRange = clipY(yBottomRaw, yTopRaw, wallHeightMm);
    if (!yRange) continue;

    const band: OpeningYBand = {
      xStartMm: xRange[0],
      xEndMm: xRange[1],
      yBottomMm: yRange[0],
      yTopMm: yRange[1],
    };
    bands.push(band);

    compiledOpenings.push({
      wallId: wall.id,
      openingId: opening.id,
      type: opening.type,
      xStartMm: band.xStartMm,
      xEndMm: band.xEndMm,
      yBottomMm: band.yBottomMm,
      yTopMm: band.yTopMm,
    });
  }

  // Merge overlapping X ranges. Openings with overlapping X share a
  // common "hole" region on the wall; we treat them as one segment in the
  // X-sweep and stack their Y-bands.
  const groups = groupByOverlappingX(bands);

  const segments: WallSegment[] = [];

  // Emit solid segments between groups and around each group's Y bands.
  let prevXEnd = 0;
  for (const group of groups) {
    const groupXStart = group.xStartMm;
    const groupXEnd = group.xEndMm;

    // Solid full-height segment BEFORE this group.
    if (groupXStart > prevXEnd) {
      segments.push({
        wallId: wall.id,
        xStartMm: prevXEnd,
        xEndMm: groupXStart,
        yBottomMm: 0,
        yTopMm: wallHeightMm,
      });
    }

    // Inside the group's X range, emit "above" and "below" bands per the
    // group's Y coverage. For MVP we only handle SINGLE openings per
    // group (the merged case is rare and the coverage-band math for
    // multi-opening groups needs an interval subtraction pass; deferred).
    const groupBands = group.bands
      .slice()
      .sort((a, b) => a.yBottomMm - b.yBottomMm);
    let coveredTop = 0;
    for (const band of groupBands) {
      if (band.yBottomMm > coveredTop) {
        segments.push({
          wallId: wall.id,
          xStartMm: groupXStart,
          xEndMm: groupXEnd,
          yBottomMm: coveredTop,
          yTopMm: band.yBottomMm,
        });
      }
      coveredTop = Math.max(coveredTop, band.yTopMm);
    }
    if (coveredTop < wallHeightMm) {
      segments.push({
        wallId: wall.id,
        xStartMm: groupXStart,
        xEndMm: groupXEnd,
        yBottomMm: coveredTop,
        yTopMm: wallHeightMm,
      });
    }

    prevXEnd = groupXEnd;
  }

  // Trailing solid segment after the last group.
  if (prevXEnd < wallLengthMm) {
    segments.push({
      wallId: wall.id,
      xStartMm: prevXEnd,
      xEndMm: wallLengthMm,
      yBottomMm: 0,
      yTopMm: wallHeightMm,
    });
  }

  // Defensive: if there are no openings, guarantee a single full segment.
  if (bands.length === 0 && segments.length === 0 && wallLengthMm > 0) {
    segments.push({
      wallId: wall.id,
      xStartMm: 0,
      xEndMm: wallLengthMm,
      yBottomMm: 0,
      yTopMm: wallHeightMm,
    });
  }

  return {
    wallId: wall.id,
    frame,
    heightMm: wallHeightMm,
    thicknessMm: wall.thicknessMm,
    segments,
    openings: compiledOpenings,
  };
}

interface OverlappingGroup {
  xStartMm: number;
  xEndMm: number;
  bands: OpeningYBand[];
}

function groupByOverlappingX(bands: readonly OpeningYBand[]): OverlappingGroup[] {
  if (bands.length === 0) return [];
  const sorted = bands.slice().sort((a, b) => a.xStartMm - b.xStartMm);
  const groups: OverlappingGroup[] = [];
  let current: OverlappingGroup = {
    xStartMm: sorted[0]!.xStartMm,
    xEndMm: sorted[0]!.xEndMm,
    bands: [sorted[0]!],
  };
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i]!;
    if (b.xStartMm <= current.xEndMm) {
      current.xEndMm = Math.max(current.xEndMm, b.xEndMm);
      current.bands.push(b);
    } else {
      groups.push(current);
      current = { xStartMm: b.xStartMm, xEndMm: b.xEndMm, bands: [b] };
    }
  }
  groups.push(current);
  return groups;
}

/** Convenience: compile every wall in a room's architecture. */
export function compileArchitecture(architecture: RoomArchitecture): CompiledWall[] {
  return architecture.walls.map(compileWall);
}
