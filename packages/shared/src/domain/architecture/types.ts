// Room Architecture Engine — deterministic architectural room model.
//
// This module owns the SHAPE of the architectural elements of a room:
// walls, floor, ceiling, and openings (doors, windows, generic openings).
// It is intentionally SEPARATE from:
//   · Cabinet Domain (manufacturable geometry — CNC path)
//   · Scene Assets (visualization / reference — GLB path)
//
// The architecture model is what the room design lives in — walls define
// the space; cabinets and scene assets are placed WITHIN that space.
//
// All measurements in MILLIMETERS. Rotations/angles in DEGREES.
// Renderer converts to meters/radians at the Three.js boundary.

export const ROOM_ARCHITECTURE_SCHEMA_VERSION = "1.0" as const;

/** Floor-plan point (top-down XZ, no Y). Y is derived from wall height. */
export interface Vec2Mm {
  x: number;
  z: number;
}

/** Ceiling visibility during editing. `auto` means the renderer hides the
 *  ceiling in interior views so the camera can look inside the room. */
export type CeilingVisibility = "auto" | "visible" | "hidden";

/** Optional per-element metadata common to floor/ceiling. */
export interface FloorDefinition {
  /** Reserved for future thickness/riser data. Currently no fields — the
   *  floor is a flat plane at Y=0 with dimensions inferred from wall
   *  extents. Present as an object so we can add fields additively. */
  reserved?: never;
}

export interface CeilingDefinition {
  visibility?: CeilingVisibility;
}

/** Door opening — sill is always at floor level (0 mm) by definition. */
export interface DoorOpening {
  id: string;
  type: "door";
  /** Distance from wall start (along wall) to the LEFT edge of the opening. */
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  /** Optional editor metadata — for swing arc overlays. */
  hingeSide?: "left" | "right";
  swingDirection?: "inward" | "outward";
  label?: string;
}

/** Window opening — sill is elevated above the floor. */
export interface WindowOpening {
  id: string;
  type: "window";
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  /** Distance from floor to bottom of window (mm). */
  sillHeightMm: number;
  label?: string;
}

/** Generic rectangular opening (pass-through, archway placeholder, etc.). */
export interface GenericOpening {
  id: string;
  type: "opening";
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  /** Sill above floor. Defaults to 0. */
  sillHeightMm?: number;
  label?: string;
}

export type WallOpening = DoorOpening | WindowOpening | GenericOpening;
export type WallOpeningType = WallOpening["type"];

/**
 * A single wall — line segment in floor-plan XZ + height + thickness +
 * openings expressed in WALL-LOCAL coordinates (offsetMm along wall).
 *
 * Stable id required: openings and wall-mounted objects use it for
 * durable references. Legacy rectangular rooms use deterministic ids
 * `wall:south / wall:east / wall:north / wall:west`.
 */
export interface WallDefinition {
  id: string;
  startMm: Vec2Mm;
  endMm: Vec2Mm;
  heightMm: number;
  thicknessMm: number;
  openings: WallOpening[];
}

export interface RoomArchitecture {
  schemaVersion: "1.0";
  floor?: FloorDefinition;
  ceiling?: CeilingDefinition;
  walls: WallDefinition[];
}
