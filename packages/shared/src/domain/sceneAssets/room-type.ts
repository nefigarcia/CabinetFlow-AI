import type { Room } from "../../types/project";

// Room-type helpers.
//
// The current Prisma model has NO dedicated `roomType` column (see Slice 5
// approval — persistence deferred). Room type lives inside `Room.metadata`
// under the key `"roomType"`. This module is the ONE place the codebase
// should read that key from, so consumers never touch the raw JSON.
//
// Unknown / missing / non-string values collapse to `"custom"`, which is
// treated as a first-class "no room-type policy applies" state by the
// downstream catalog policy.

export type RoomType =
  | "kitchen"
  | "living_room"
  | "bedroom"
  | "bathroom"
  | "closet"
  | "laundry"
  | "office"
  | "custom";

export const ROOM_TYPES: readonly RoomType[] = [
  "kitchen",
  "living_room",
  "bedroom",
  "bathroom",
  "closet",
  "laundry",
  "office",
  "custom",
];

/** Human-friendly labels for each room type. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  kitchen: "Kitchen",
  living_room: "Living Room",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  closet: "Closet",
  laundry: "Laundry",
  office: "Office",
  custom: "Custom",
};

// Common aliases we normalize into the canonical RoomType. Kept short and
// predictable — we do NOT try to synonym-match arbitrary user input.
// Additions should have real user evidence before being added.
const ROOM_TYPE_ALIASES: Record<string, RoomType> = {
  living: "living_room",
  family_room: "living_room",
  great_room: "living_room",
  primary_bedroom: "bedroom",
  master_bedroom: "bedroom",
  primary_bathroom: "bathroom",
  master_bathroom: "bathroom",
  powder_room: "bathroom",
  wc: "bathroom",
  utility: "laundry",
  utility_room: "laundry",
  laundry_room: "laundry",
  walk_in_closet: "closet",
  wardrobe: "closet",
  study: "office",
  home_office: "office",
};

const CANONICAL_SET: ReadonlySet<RoomType> = new Set(ROOM_TYPES);

/** Best-effort normalization of a raw string to a canonical `RoomType`.
 *  Falls back to `"custom"` when the input is unknown or not a string. */
export function normalizeRoomType(raw: unknown): RoomType {
  if (typeof raw !== "string") return "custom";
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (key.length === 0) return "custom";
  if (CANONICAL_SET.has(key as RoomType)) return key as RoomType;
  const alias = ROOM_TYPE_ALIASES[key];
  return alias ?? "custom";
}

/** Returns the canonical `RoomType` for a Room. Reads `metadata.roomType`
 *  and applies alias normalization. Missing / unknown → `"custom"`. */
export function getRoomType(
  room: Pick<Room, "metadata"> | null | undefined,
): RoomType {
  if (!room) return "custom";
  const meta = room.metadata;
  if (!meta || typeof meta !== "object") return "custom";
  const raw = (meta as Record<string, unknown>)["roomType"];
  return normalizeRoomType(raw);
}
