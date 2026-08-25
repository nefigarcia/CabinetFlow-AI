import { create } from "zustand";
import {
  clearCabinetSelections,
  emptyMaterialSelection,
  materialSelectionSchema,
  setCabinetSlot,
  setRoomSlot,
  type CabinetMaterialSelection,
  type MaterialSelection,
  type RoomMaterialSelection,
} from "@woodcraft/shared";

// Editor-side material selection store. Purely serializable — never holds
// THREE.js objects. The render layer resolves each MaterialSlot through
// the shared resolver on every render pass.
//
// Persistence: MVP saves to localStorage keyed by projectId. Server-side
// persistence lands in a follow-up milestone alongside the shop-profile
// catalog.

interface MaterialsState {
  projectId: string | null;
  selection: MaterialSelection;

  loadForProject: (projectId: string) => void;
  setRoomMaterial: (slot: keyof RoomMaterialSelection, materialId: string | undefined) => void;
  setCabinetMaterial: (
    cabinetId: string,
    slot: keyof CabinetMaterialSelection,
    materialId: string | undefined,
  ) => void;
  clearCabinet: (cabinetId: string) => void;
  resetAll: () => void;
}

const LS_PREFIX = "woodcraft.materials.v1.";

function localStorageKey(projectId: string): string {
  return `${LS_PREFIX}${projectId}`;
}

function loadFromLocalStorage(projectId: string): MaterialSelection {
  if (typeof window === "undefined") return emptyMaterialSelection();
  try {
    const raw = window.localStorage.getItem(localStorageKey(projectId));
    if (!raw) return emptyMaterialSelection();
    const parsed = JSON.parse(raw);
    return materialSelectionSchema.parse(parsed);
  } catch {
    return emptyMaterialSelection();
  }
}

function saveToLocalStorage(projectId: string, selection: MaterialSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localStorageKey(projectId), JSON.stringify(selection));
  } catch {
    // ignore quota / disabled storage
  }
}

export const useMaterialsStore = create<MaterialsState>((set, get) => ({
  projectId: null,
  selection: emptyMaterialSelection(),

  loadForProject: (projectId) => {
    const selection = loadFromLocalStorage(projectId);
    set({ projectId, selection });
  },

  setRoomMaterial: (slot, materialId) => {
    const { projectId, selection } = get();
    const next = setRoomSlot(selection, slot, materialId);
    set({ selection: next });
    if (projectId) saveToLocalStorage(projectId, next);
  },

  setCabinetMaterial: (cabinetId, slot, materialId) => {
    const { projectId, selection } = get();
    const next = setCabinetSlot(selection, cabinetId, slot, materialId);
    set({ selection: next });
    if (projectId) saveToLocalStorage(projectId, next);
  },

  clearCabinet: (cabinetId) => {
    const { projectId, selection } = get();
    const next = clearCabinetSelections(selection, cabinetId);
    set({ selection: next });
    if (projectId) saveToLocalStorage(projectId, next);
  },

  resetAll: () => {
    const { projectId } = get();
    const next = emptyMaterialSelection();
    set({ selection: next });
    if (projectId) saveToLocalStorage(projectId, next);
  },
}));
