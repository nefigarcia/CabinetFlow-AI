import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import type { Cabinet, Room, SceneAssetInstance } from "@woodcraft/shared";

// Discriminated union used by the Inspector to pick its content.
// Derived from useEditorStore's existing selection state — no additional
// selection primitives are needed in STEP 2. When part-selection lands
// (STEP 5+), extend the kind here.

export type Selection =
  | { kind: "none" }
  | { kind: "room"; roomId: string }
  | { kind: "cabinet"; cabinetId: string }
  | { kind: "part"; cabinetId: string; partId: string }
  | { kind: "sceneAsset"; assetInstanceId: string }
  | { kind: "wall"; wallId: string }
  | { kind: "opening"; wallId: string; openingId: string };

/** Hook: returns the current logical selection based on the editor store.
 *  Priority: opening > wall > sceneAsset > cabinet > room > none. Every
 *  domain-selection setter cross-clears the others so at most one kind is
 *  non-null at any time. Room selection is the fallback "context" and
 *  never blocks the others. */
export function useSelection(): Selection {
  const selectedOpeningId = useEditorStore((s) => s.selectedOpeningId);
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedSceneAssetId = useEditorStore((s) => s.selectedSceneAssetId);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  if (selectedOpeningId && selectedWallId) {
    return { kind: "opening", wallId: selectedWallId, openingId: selectedOpeningId };
  }
  if (selectedWallId) return { kind: "wall", wallId: selectedWallId };
  if (selectedSceneAssetId) {
    return { kind: "sceneAsset", assetInstanceId: selectedSceneAssetId };
  }
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

/** Look up the currently selected Scene Asset instance from its store. */
export function useSelectedSceneAssetInstance(): SceneAssetInstance | undefined {
  const instances = useSceneAssetsStore((s) => s.instances);
  const selectedSceneAssetId = useEditorStore((s) => s.selectedSceneAssetId);
  if (!selectedSceneAssetId) return undefined;
  return instances.find((i) => i.id === selectedSceneAssetId);
}
