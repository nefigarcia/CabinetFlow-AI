import { z } from "zod";
import type { MaterialSlot } from "./material-slots";
import { materialSlotSchema } from "./material-slots";

// A serializable per-project material selection. Stored in Zustand and
// persisted to localStorage (for MVP) keyed by projectId. Never carries
// THREE.js objects — always plain material-profile IDs.

export interface RoomMaterialSelection {
  floor?: string;
  wall?: string;
  backsplash?: string;
  countertop?: string;
}

export interface CabinetMaterialSelection {
  /** Blanket cabinet finish. Individual slot fields override this. */
  cabinetExterior?: string;
  cabinetInterior?: string;
  door?: string;
  drawerFront?: string;
  shelf?: string;
  toeKick?: string;
  faceFrame?: string;
  finishedEnd?: string;
  hardware?: string;
}

export interface MaterialSelection {
  schemaVersion: "1.0";
  room: RoomMaterialSelection;
  cabinets: Record<string, CabinetMaterialSelection>;
}

export const MATERIAL_SELECTION_SCHEMA_VERSION = "1.0" as const;

export function emptyMaterialSelection(): MaterialSelection {
  return {
    schemaVersion: MATERIAL_SELECTION_SCHEMA_VERSION,
    room: {},
    cabinets: {},
  };
}

const roomSchema: z.ZodType<RoomMaterialSelection> = z.object({
  floor: z.string().optional(),
  wall: z.string().optional(),
  backsplash: z.string().optional(),
  countertop: z.string().optional(),
});

const cabinetSchema: z.ZodType<CabinetMaterialSelection> = z.object({
  cabinetExterior: z.string().optional(),
  cabinetInterior: z.string().optional(),
  door: z.string().optional(),
  drawerFront: z.string().optional(),
  shelf: z.string().optional(),
  toeKick: z.string().optional(),
  faceFrame: z.string().optional(),
  finishedEnd: z.string().optional(),
  hardware: z.string().optional(),
});

export const materialSelectionSchema: z.ZodType<MaterialSelection> = z.object({
  schemaVersion: z.literal(MATERIAL_SELECTION_SCHEMA_VERSION),
  room: roomSchema,
  cabinets: z.record(cabinetSchema),
});

/** Read helper — returns undefined when nothing is selected for the slot. */
export function readCabinetSlot(
  selection: MaterialSelection,
  cabinetId: string,
  slot: MaterialSlot,
): string | undefined {
  const cab = selection.cabinets[cabinetId];
  if (!cab) return undefined;
  return (cab as Record<string, string | undefined>)[slot];
}

/** Read helper for room-level slots. */
export function readRoomSlot(
  selection: MaterialSelection,
  slot: keyof RoomMaterialSelection,
): string | undefined {
  return selection.room[slot];
}

/** Immutable setter — returns a new selection with the room slot updated. */
export function setRoomSlot(
  selection: MaterialSelection,
  slot: keyof RoomMaterialSelection,
  materialId: string | undefined,
): MaterialSelection {
  const room = { ...selection.room };
  if (materialId === undefined) delete room[slot];
  else room[slot] = materialId;
  return { ...selection, room };
}

/** Immutable setter — returns a new selection with the cabinet slot updated. */
export function setCabinetSlot(
  selection: MaterialSelection,
  cabinetId: string,
  slot: keyof CabinetMaterialSelection,
  materialId: string | undefined,
): MaterialSelection {
  const cabinets = { ...selection.cabinets };
  const existing: CabinetMaterialSelection = { ...(cabinets[cabinetId] ?? {}) };
  if (materialId === undefined) {
    delete (existing as Record<string, string | undefined>)[slot];
  } else {
    (existing as Record<string, string | undefined>)[slot] = materialId;
  }
  if (Object.keys(existing).length === 0) {
    delete cabinets[cabinetId];
  } else {
    cabinets[cabinetId] = existing;
  }
  return { ...selection, cabinets };
}

/** Remove all selections for a cabinet (e.g. when it's deleted). */
export function clearCabinetSelections(
  selection: MaterialSelection,
  cabinetId: string,
): MaterialSelection {
  if (!(cabinetId in selection.cabinets)) return selection;
  const cabinets = { ...selection.cabinets };
  delete cabinets[cabinetId];
  return { ...selection, cabinets };
}
