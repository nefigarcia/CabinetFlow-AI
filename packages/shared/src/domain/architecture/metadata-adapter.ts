import type { Room } from "../../types/project";
import type { RoomArchitecture } from "./types";
import { roomArchitectureSchema } from "./schema";
import { deriveDefaultRoomArchitecture } from "./legacy-adapter";

// Reads/writes `Room.metadata.architecture` in a safe, single-source way.
//
// The rest of the codebase never touches `room.metadata.architecture`
// directly — it goes through these helpers so:
//   · malformed JSON never crashes callers (falls back to legacy adapter)
//   · the storage key ("architecture") is defined once
//   · a future migration to a dedicated `RoomArchitecture` table changes
//     only this file, not consumers

export const ROOM_ARCHITECTURE_METADATA_KEY = "architecture" as const;

/**
 * Returns the room's architecture. If `metadata.architecture` is missing
 * or malformed, DERIVES a deterministic rectangular architecture from the
 * room's width/height/depth so every room in production works without a
 * migration.
 *
 * Never returns null — the room ALWAYS has a valid architecture.
 */
export function getRoomArchitecture(
  room: Pick<Room, "metadata" | "width" | "height" | "depth">,
): RoomArchitecture {
  const meta = room.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const raw = (meta as Record<string, unknown>)[ROOM_ARCHITECTURE_METADATA_KEY];
    if (raw !== undefined) {
      const parsed = roomArchitectureSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      // Malformed stored architecture — silently fall through to the
      // legacy adapter. The editor UI reports the same problem via
      // `validateArchitecture` when the user opens the room.
    }
  }
  return deriveDefaultRoomArchitecture(room);
}

/**
 * Merges `architecture` into an existing metadata object (or creates a
 * fresh one) without disturbing other keys. Returns the FULL metadata
 * value to PATCH back to the server — the Room PATCH route stores the
 * `metadata` field wholesale.
 */
export function withRoomArchitecture(
  currentMetadata: Room["metadata"],
  architecture: RoomArchitecture,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    currentMetadata && typeof currentMetadata === "object" && !Array.isArray(currentMetadata)
      ? { ...(currentMetadata as Record<string, unknown>) }
      : {};
  base[ROOM_ARCHITECTURE_METADATA_KEY] = architecture;
  return base;
}
