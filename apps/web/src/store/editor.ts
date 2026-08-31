import { create } from "zustand";
import type { Cabinet, Room } from "@woodcraft/shared";

interface EditorState {
  projectId: string | null;
  rooms: Room[];
  selectedRoomId: string | null;
  cabinets: Cabinet[];
  selectedCabinetId: string | null;
  /**
   * Currently selected Scene Asset instance id. Scene-asset instances
   * themselves live in `useSceneAssetsStore`; selection state lives here so
   * the workspace has a SINGLE selection source of truth (never duplicated).
   * At most one of `selectedCabinetId` / `selectedSceneAssetId` is non-null
   * at any time — the two selection actions cross-clear each other.
   */
  selectedSceneAssetId: string | null;
  /** Currently selected architectural wall id. Same "single-active-kind"
   *  rule as cabinet/scene-asset — the setters cross-clear each other. */
  selectedWallId: string | null;
  /** Currently selected opening within the selected wall. Only meaningful
   *  when `selectedWallId` is non-null. */
  selectedOpeningId: string | null;
  isDirty: boolean;

  setProject: (projectId: string) => void;
  setRooms: (rooms: Room[]) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  selectRoom: (roomId: string | null) => void;
  setCabinets: (cabinets: Cabinet[]) => void;
  addCabinet: (cabinet: Cabinet) => void;
  selectCabinet: (cabinetId: string | null) => void;
  selectSceneAsset: (assetInstanceId: string | null) => void;
  selectWall: (wallId: string | null) => void;
  selectOpening: (wallId: string, openingId: string | null) => void;
  updateCabinet: (id: string, patch: Partial<Cabinet>) => void;
  markDirty: () => void;
  markClean: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  projectId: null,
  rooms: [],
  selectedRoomId: null,
  cabinets: [],
  selectedCabinetId: null,
  selectedSceneAssetId: null,
  selectedWallId: null,
  selectedOpeningId: null,
  isDirty: false,

  setProject: (projectId) => set({ projectId }),

  setRooms: (rooms) => set({ rooms }),

  updateRoom: (id, patch) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  selectRoom: (selectedRoomId) => set({ selectedRoomId }),

  setCabinets: (cabinets) => set({ cabinets }),

  addCabinet: (cabinet) =>
    set((state) => ({ cabinets: [...state.cabinets, cabinet] })),

  // Cross-clear the other selection kinds — at most ONE domain selection
  // is active at any time. Clicking empty space (via onPointerMissed →
  // selectCabinet(null)) clears every non-room selection.
  selectCabinet: (selectedCabinetId) =>
    set({
      selectedCabinetId,
      selectedSceneAssetId: null,
      selectedWallId: null,
      selectedOpeningId: null,
    }),

  selectSceneAsset: (selectedSceneAssetId) =>
    set({
      selectedSceneAssetId,
      selectedCabinetId: null,
      selectedWallId: null,
      selectedOpeningId: null,
    }),

  selectWall: (selectedWallId) =>
    set({
      selectedWallId,
      selectedOpeningId: null,
      selectedCabinetId: null,
      selectedSceneAssetId: null,
    }),

  selectOpening: (selectedWallId, selectedOpeningId) =>
    set({
      selectedWallId,
      selectedOpeningId,
      selectedCabinetId: null,
      selectedSceneAssetId: null,
    }),

  updateCabinet: (id, patch) =>
    set((state) => ({
      cabinets: state.cabinets.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
      isDirty: true,
    })),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
}));
