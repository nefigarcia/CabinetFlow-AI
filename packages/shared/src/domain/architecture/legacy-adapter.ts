import type { Room } from "../../types/project";
import type { RoomArchitecture, WallDefinition } from "./types";
import { ROOM_ARCHITECTURE_SCHEMA_VERSION } from "./types";

// Legacy-room compatibility.
//
// Existing rooms carry only `width` / `height` / `depth` (mm). This module
// derives the deterministic rectangular architecture from those dimensions
// so every room in production works without persistence changes.
//
// Wall winding: COUNTER-CLOCKWISE viewed from above so wall-local Z
// (inward normal computed elsewhere) points INTO the room.
//
//   Floor plan (top-down, +X right, +Z into screen):
//
//        z=depth   +----------------+   (width, depth)
//                  |                |
//                  |      room      |
//                  |                |
//         z=0      +----------------+   (width, 0)
//                (0,0)
//
//   Walls listed CCW starting from south (z=0):
//     south:  (0, 0)   → (W, 0)      — wall along z=0, inward normal +Z
//     east:   (W, 0)   → (W, D)      — wall along x=W, inward normal -X
//     north:  (W, D)   → (0, D)      — wall along z=D, inward normal -Z
//     west:   (0, D)   → (0, 0)      — wall along x=0, inward normal +X

/** Standard wall ids for the auto-derived rectangular architecture. Stable
 *  so consumers (openings, wall-mounted objects) can reference them
 *  without index dependence. */
export const LEGACY_WALL_IDS = {
  south: "wall:south",
  east: "wall:east",
  north: "wall:north",
  west: "wall:west",
} as const;

/** Default wall thickness for legacy-derived rooms (mm). Matches the
 *  historic 50 mm value used by the old `RoomShell`. */
export const LEGACY_WALL_THICKNESS_MM = 50;

/**
 * Produce a valid deterministic `RoomArchitecture` from a room's legacy
 * width/height/depth. No openings are added — the caller can insert
 * openings later via user edits.
 */
export function deriveDefaultRoomArchitecture(
  room: Pick<Room, "width" | "height" | "depth">,
): RoomArchitecture {
  const w = Number(room.width);
  const h = Number(room.height);
  const d = Number(room.depth);

  const walls: WallDefinition[] = [
    {
      id: LEGACY_WALL_IDS.south,
      startMm: { x: 0, z: 0 },
      endMm: { x: w, z: 0 },
      heightMm: h,
      thicknessMm: LEGACY_WALL_THICKNESS_MM,
      openings: [],
    },
    {
      id: LEGACY_WALL_IDS.east,
      startMm: { x: w, z: 0 },
      endMm: { x: w, z: d },
      heightMm: h,
      thicknessMm: LEGACY_WALL_THICKNESS_MM,
      openings: [],
    },
    {
      id: LEGACY_WALL_IDS.north,
      startMm: { x: w, z: d },
      endMm: { x: 0, z: d },
      heightMm: h,
      thicknessMm: LEGACY_WALL_THICKNESS_MM,
      openings: [],
    },
    {
      id: LEGACY_WALL_IDS.west,
      startMm: { x: 0, z: d },
      endMm: { x: 0, z: 0 },
      heightMm: h,
      thicknessMm: LEGACY_WALL_THICKNESS_MM,
      openings: [],
    },
  ];

  return {
    schemaVersion: ROOM_ARCHITECTURE_SCHEMA_VERSION,
    walls,
  };
}
