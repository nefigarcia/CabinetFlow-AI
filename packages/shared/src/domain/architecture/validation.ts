import type { RoomArchitecture, WallDefinition, WallOpening } from "./types";
import { getWallLengthMm } from "./wall-math";

// Architecture validation — pure warnings + errors emitted for review by
// the editor UI. Never blocks a save; the domain preserves the user's
// intent so they can fix it interactively.
//
// Every issue carries `source: "architecture"` so consumers can keep it
// distinct from `scene` / `manufacturing` / `ai` validation results.

export type ArchitectureIssueCode =
  | "WALL_ZERO_LENGTH"
  | "WALL_NEGATIVE_HEIGHT"
  | "WALL_NEGATIVE_THICKNESS"
  | "OPENING_NON_POSITIVE_WIDTH"
  | "OPENING_NON_POSITIVE_HEIGHT"
  | "OPENING_BELOW_FLOOR"
  | "OPENING_ABOVE_CEILING"
  | "OPENING_OFFSET_NEGATIVE"
  | "OPENING_OUTSIDE_WALL"
  | "OPENING_OVERLAP"
  | "WINDOW_SILL_NEGATIVE"
  | "DOOR_SILL_NOT_FLOOR";

export interface ArchitectureIssue {
  code: ArchitectureIssueCode;
  severity: "warning" | "error";
  source: "architecture";
  wallId?: string;
  openingId?: string;
  message: string;
}

/** Validates one wall in isolation — call once per wall. */
export function validateWall(wall: WallDefinition): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  const lengthMm = getWallLengthMm(wall);

  if (lengthMm === 0) {
    issues.push({
      code: "WALL_ZERO_LENGTH",
      severity: "error",
      source: "architecture",
      wallId: wall.id,
      message: `Wall has zero length (start and end are the same point).`,
    });
  }

  if (wall.heightMm <= 0) {
    issues.push({
      code: "WALL_NEGATIVE_HEIGHT",
      severity: "error",
      source: "architecture",
      wallId: wall.id,
      message: `Wall height must be positive (got ${wall.heightMm} mm).`,
    });
  }

  if (wall.thicknessMm <= 0) {
    issues.push({
      code: "WALL_NEGATIVE_THICKNESS",
      severity: "error",
      source: "architecture",
      wallId: wall.id,
      message: `Wall thickness must be positive (got ${wall.thicknessMm} mm).`,
    });
  }

  // Openings.
  for (const opening of wall.openings) {
    issues.push(...validateOpening(opening, wall, lengthMm));
  }

  // Overlap check — pairwise, deterministic ordering.
  const sorted = wall.openings.slice().sort((a, b) => a.offsetMm - b.offsetMm);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const aEnd = a.offsetMm + a.widthMm;
    if (aEnd > b.offsetMm) {
      issues.push({
        code: "OPENING_OVERLAP",
        severity: "warning",
        source: "architecture",
        wallId: wall.id,
        openingId: b.id,
        message: `Opening "${b.id}" overlaps with "${a.id}" on the same wall.`,
      });
    }
  }

  return issues;
}

/** Validate a single opening against its parent wall's dimensions. */
export function validateOpening(
  opening: WallOpening,
  wall: WallDefinition,
  wallLengthMm: number,
): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];

  if (opening.widthMm <= 0) {
    issues.push({
      code: "OPENING_NON_POSITIVE_WIDTH",
      severity: "error",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" has non-positive width (${opening.widthMm} mm).`,
    });
  }
  if (opening.heightMm <= 0) {
    issues.push({
      code: "OPENING_NON_POSITIVE_HEIGHT",
      severity: "error",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" has non-positive height (${opening.heightMm} mm).`,
    });
  }
  if (opening.offsetMm < 0) {
    issues.push({
      code: "OPENING_OFFSET_NEGATIVE",
      severity: "warning",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" starts before the wall (offset ${opening.offsetMm} mm).`,
    });
  }
  if (opening.offsetMm + opening.widthMm > wallLengthMm) {
    issues.push({
      code: "OPENING_OUTSIDE_WALL",
      severity: "warning",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" extends past the end of the wall.`,
    });
  }

  const sillMm =
    opening.type === "door"
      ? 0
      : opening.type === "window"
        ? opening.sillHeightMm
        : (opening.sillHeightMm ?? 0);

  if (sillMm < 0) {
    issues.push({
      code: "OPENING_BELOW_FLOOR",
      severity: "warning",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" sits below floor level.`,
    });
  }

  if (sillMm + opening.heightMm > wall.heightMm) {
    issues.push({
      code: "OPENING_ABOVE_CEILING",
      severity: "warning",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Opening "${opening.id}" extends above the ceiling.`,
    });
  }

  // Type-specific consistency checks.
  if (opening.type === "window" && opening.sillHeightMm < 0) {
    issues.push({
      code: "WINDOW_SILL_NEGATIVE",
      severity: "warning",
      source: "architecture",
      wallId: wall.id,
      openingId: opening.id,
      message: `Window "${opening.id}" has a negative sill height.`,
    });
  }

  return issues;
}

/** Validates the full room architecture. */
export function validateArchitecture(architecture: RoomArchitecture): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  for (const wall of architecture.walls) {
    issues.push(...validateWall(wall));
  }
  return issues;
}
