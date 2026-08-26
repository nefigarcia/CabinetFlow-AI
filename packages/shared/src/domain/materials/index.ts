// Public surface of the Material Rendering domain (V2.6.0 MVP).
//
// Complements the manufacturing MaterialProfile at
// packages/shared/src/domain/profiles/material.ts. This module carries
// only the render-time information the browser Three.js layer needs.

export type { MaterialCategory } from "./material-category";
export {
  CATEGORY_DEFAULT_SCALE_MM,
  MATERIAL_CATEGORIES,
  materialCategorySchema,
} from "./material-category";

export type { MaterialSlot } from "./material-slots";
export {
  MATERIAL_SLOTS,
  MATERIAL_SLOT_LABELS,
  SLOT_ALLOWED_CATEGORIES,
  SLOT_FALLBACK_CHAIN,
  materialSlotSchema,
} from "./material-slots";

export type {
  MaterialFinish,
  MaterialGrainDirection,
  MaterialRenderProfile,
  MaterialTextureMap,
} from "./material-render-profile";
export {
  materialRenderProfileSchema,
  materialTextureMapSchema,
} from "./material-render-profile";

export {
  DEFAULT_MATERIAL_ID_BY_CATEGORY,
  DEMO_MATERIAL_REGISTRY,
  findMaterial,
  materialsByCategory,
} from "./material-registry";

export type {
  CabinetMaterialSelection,
  MaterialSelection,
  RoomMaterialSelection,
} from "./material-selection";
export {
  MATERIAL_SELECTION_SCHEMA_VERSION,
  clearCabinetSelections,
  emptyMaterialSelection,
  materialSelectionSchema,
  readCabinetSlot,
  readRoomSlot,
  setCabinetSlot,
  setRoomSlot,
} from "./material-selection";

export type { ResolutionOrigin, ResolvedMaterial } from "./material-resolver";
export { resolveSlotMaterial } from "./material-resolver";
