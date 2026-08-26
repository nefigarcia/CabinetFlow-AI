import { useEditorStore } from "@/store/editor";
import type { Cabinet, Room } from "@woodcraft/shared";

// Discriminated union used by the Inspector to pick its content.
// Derived from useEditorStore's existing selection state — no additional
// selection primitives are needed in STEP 2. When part-selection lands
// (STEP 5+), extend the kind here.

export type Selection =
  | { kind: "none" }
  | { kind: "room"; roomId: string }
  | { kind: "cabinet"; cabinetId: string }
  | { kind: "part"; cabinetId: string; partId: string };

/** Hook: returns the current logical selection based on the editor store.
 *  A cabinet takes precedence over a room; the room is used as a fallback
 *  so the Inspector always has SOMETHING to show when a room is loaded. */
export function useSelection(): Selection {
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  if (selectedCabinetId) return { kind: "cabinet", cabinetId: selectedCabinetId };
  if (selectedRoomId) return { kind: "room", roomId: selectedRoomId };
  return { kind: "none" };
}

/** Look up the currently selected cabinet from the store. */
export function useSelectedCabinet(): Cabinet | undefined {
  const cabinets = useEditorStore((s) => s.cabinets);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  if (!selectedCabinetId) return undefined;
  return cabinets.find((c) => c.id === selectedCabinetId);
}

/** Look up the currently selected room from the store. */
export function useSelectedRoom(): Room | undefined {
  const rooms = useEditorStore((s) => s.rooms);
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  if (!selectedRoomId) return undefined;
  return rooms.find((r) => r.id === selectedRoomId);
}
