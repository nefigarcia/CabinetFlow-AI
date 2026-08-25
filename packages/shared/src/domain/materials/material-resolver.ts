import type { MaterialRenderProfile } from "./material-render-profile";
import {
  DEFAULT_MATERIAL_ID_BY_CATEGORY,
  findMaterial,
} from "./material-registry";
import type { MaterialSelection } from "./material-selection";
import {
  readCabinetSlot,
  readRoomSlot,
  type RoomMaterialSelection,
} from "./material-selection";
import type { MaterialSlot } from "./material-slots";
import { SLOT_ALLOWED_CATEGORIES, SLOT_FALLBACK_CHAIN } from "./material-slots";

// resolveSlotMaterial walks the resolution chain to pick the effective
// MaterialRenderProfile for a (cabinetId, slot) pair. The chain is:
//
//   1. Cabinet-level slot override                (cabinets[id][slot])
//   2. Cabinet-level slot fallback chain          (per SLOT_FALLBACK_CHAIN)
//   3. Room-level slot (floor/wall/backsplash/countertop)
//   4. Global default per allowed category (SLOT_ALLOWED_CATEGORIES[0])
//
// Never returns undefined for a slot with an entry in SLOT_ALLOWED_CATEGORIES.

export type ResolutionOrigin =
  | "cabinet-slot"
  | "cabinet-fallback-slot"
  | "room-slot"
  | "global-default";

export interface ResolvedMaterial {
  profile: MaterialRenderProfile;
  origin: ResolutionOrigin;
  /** Slot the material was actually looked up under (may differ from the
   *  requested slot when a fallback fired). */
  sourceSlot: MaterialSlot | keyof RoomMaterialSelection;
}

/** Map slots that also have a room-level equivalent. */
const ROOM_LEVEL_SLOTS: Partial<Record<MaterialSlot, keyof RoomMaterialSelection>> = {
  floor: "floor",
  wall: "wall",
  backsplash: "backsplash",
  countertop: "countertop",
};

function tryLookup(id: string | undefined): MaterialRenderProfile | undefined {
  if (!id) return undefined;
  return findMaterial(id);
}

/**
 * Resolves the effective MaterialRenderProfile for a cabinet+slot pair.
 *
 * The `cabinetId` may be `null` for scene-level slots (floor, wall,
 * backsplash, countertop rendered on the room shell rather than on a
 * specific cabinet).
 */
export function resolveSlotMaterial(
  selection: MaterialSelection,
  cabinetId: string | null,
  slot: MaterialSlot,
): ResolvedMaterial {
  // 1. Cabinet-level explicit slot override
  if (cabinetId) {
    const direct = tryLookup(readCabinetSlot(selection, cabinetId, slot));
    if (direct) {
      return { profile: direct, origin: "cabinet-slot", sourceSlot: slot };
    }

    // 2. Cabinet-level fallback chain
    let cursor = SLOT_FALLBACK_CHAIN[slot];
    while (cursor) {
      const cascaded = tryLookup(readCabinetSlot(selection, cabinetId, cursor));
      if (cascaded) {
        return { profile: cascaded, origin: "cabinet-fallback-slot", sourceSlot: cursor };
      }
      cursor = SLOT_FALLBACK_CHAIN[cursor];
    }
  }

  // 3. Room-level slot
  const roomSlot = ROOM_LEVEL_SLOTS[slot];
  if (roomSlot) {
    const roomHit = tryLookup(readRoomSlot(selection, roomSlot));
    if (roomHit) {
      return { profile: roomHit, origin: "room-slot", sourceSlot: roomSlot };
    }
  }

  // 3b. For countertop specifically, an unselected slot may fall to room
  // countertop even when the request came from a cabinet mesh.
  if (slot === "countertop") {
    const roomHit = tryLookup(readRoomSlot(selection, "countertop"));
    if (roomHit) {
      return { profile: roomHit, origin: "room-slot", sourceSlot: "countertop" };
    }
  }

  // 4. Global default from the first allowed category for this slot
  const allowed = SLOT_ALLOWED_CATEGORIES[slot];
  const category = allowed[0];
  if (category === undefined) {
    throw new Error(`resolveSlotMaterial: slot '${slot}' has no allowed categories`);
  }
  const defaultId = DEFAULT_MATERIAL_ID_BY_CATEGORY[category];
  const fallback = findMaterial(defaultId);
  if (!fallback) {
    throw new Error(
      `resolveSlotMaterial: registry missing default material '${defaultId}' for category '${category}'`,
    );
  }
  return { profile: fallback, origin: "global-default", sourceSlot: slot };
}
