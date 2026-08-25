import { z } from "zod";
import type { MaterialCategory } from "./material-category";

// A MaterialSlot names WHERE a material is applied in a scene, independent
// of what physical material fills it. The resolver picks the effective
// MaterialRenderProfile for a slot based on the current selection.

export type MaterialSlot =
  | "cabinetExterior"
  | "cabinetInterior"
  | "door"
  | "drawerFront"
  | "shelf"
  | "toeKick"
  | "faceFrame"
  | "finishedEnd"
  | "countertop"
  | "backsplash"
  | "floor"
  | "wall"
  | "hardware"
  | "appliance";

export const materialSlotSchema: z.ZodType<MaterialSlot> = z.enum([
  "cabinetExterior",
  "cabinetInterior",
  "door",
  "drawerFront",
  "shelf",
  "toeKick",
  "faceFrame",
  "finishedEnd",
  "countertop",
  "backsplash",
  "floor",
  "wall",
  "hardware",
  "appliance",
]);

export const MATERIAL_SLOTS: readonly MaterialSlot[] = [
  "cabinetExterior",
  "cabinetInterior",
  "door",
  "drawerFront",
  "shelf",
  "toeKick",
  "faceFrame",
  "finishedEnd",
  "countertop",
  "backsplash",
  "floor",
  "wall",
  "hardware",
  "appliance",
];

/** Human-friendly labels for each slot, for use in UI. */
export const MATERIAL_SLOT_LABELS: Record<MaterialSlot, string> = {
  cabinetExterior: "Cabinet exterior",
  cabinetInterior: "Cabinet interior",
  door: "Door",
  drawerFront: "Drawer front",
  shelf: "Shelf",
  toeKick: "Toe kick",
  faceFrame: "Face frame",
  finishedEnd: "Finished end",
  countertop: "Countertop",
  backsplash: "Backsplash",
  floor: "Floor",
  wall: "Wall",
  hardware: "Hardware",
  appliance: "Appliance",
};

/**
 * For every slot, the ordered set of MaterialCategories that are
 * appropriate to place in that slot. UI uses this to filter the picker.
 */
export const SLOT_ALLOWED_CATEGORIES: Record<MaterialSlot, readonly MaterialCategory[]> = {
  cabinetExterior: ["painted", "wood", "laminate"],
  cabinetInterior: ["painted", "wood", "laminate"],
  door: ["painted", "wood", "laminate"],
  drawerFront: ["painted", "wood", "laminate"],
  shelf: ["painted", "wood", "laminate"],
  toeKick: ["painted", "wood", "laminate"],
  faceFrame: ["painted", "wood"],
  finishedEnd: ["painted", "wood", "laminate"],
  countertop: ["stone", "laminate", "wood"],
  backsplash: ["backsplash", "stone"],
  floor: ["floor", "wood", "stone"],
  wall: ["wall", "painted"],
  hardware: ["hardware", "metal"],
  appliance: ["metal", "painted"],
};

/**
 * If a slot has no user-chosen material and no cabinet/room default, the
 * resolver falls back to this slot to look up its cabinet-level parent.
 * (e.g. an unset `drawerFront` inherits from `cabinetExterior`.) The chain
 * always terminates at a slot with no parent (`undefined`).
 */
export const SLOT_FALLBACK_CHAIN: Record<MaterialSlot, MaterialSlot | undefined> = {
  cabinetExterior: undefined,
  cabinetInterior: "cabinetExterior",
  door: "cabinetExterior",
  drawerFront: "door",
  shelf: "cabinetInterior",
  toeKick: "cabinetExterior",
  faceFrame: "cabinetExterior",
  finishedEnd: "cabinetExterior",
  countertop: undefined,
  backsplash: undefined,
  floor: undefined,
  wall: undefined,
  hardware: undefined,
  appliance: undefined,
};
