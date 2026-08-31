// Public surface of the Cabinet Design domain.
//
// This domain sits BETWEEN the architecture domain (walls / openings)
// and the manufacturing compiler (types/geometry.ts). It never touches
// the compiler and never generates parts — the compiler remains the
// single source of truth for manufacturable geometry.

export type {
  CabinetFacing,
  CabinetWallPlacement,
} from "./wall-placement";
export {
  CABINET_WALL_PLACEMENT_KEY,
  DEFAULT_WALL_CABINET_ELEVATION_MM,
  cabinetWallPlacementSchema,
  computeCabinetWorldPosition,
  defaultBaseElevationMm,
  getCabinetWallPlacement,
  inferNearestWallForCabinet,
  isCabinetWallAttached,
  isFloorMountedCabinetType,
  isWallMountedCabinetType,
  resolveCabinetWorldPosition,
  withCabinetWallPlacement,
} from "./wall-placement";

export type {
  CabinetRun,
  CabinetRunItem,
  RunGap,
  RunGapKind,
  RunOverlap,
  RemainingSpace,
  RemainingSpaceInput,
} from "./cabinet-run";
export {
  EXACT_TOL_MM,
  FILLER_MAX_MM,
  buildCabinetRuns,
  detectRunGaps,
  detectRunOverlaps,
  filterFloorMountedRun,
  getApplianceExtentsOnWall,
  getCabinetRunExtent,
  getFreeCabinets,
  getRemainingWallSpace,
  getRunCabinetsWidthSum,
  projectWorldCenterOntoWall,
  sortRunItems,
} from "./cabinet-run";

export type {
  DistributeStrategy,
  FitRunReport,
  FitRunSuggestion,
  InsertResult,
  RunAppendResult,
} from "./run-operations";
export {
  chainAppendLeft,
  chainAppendRight,
  distributeRun,
  fitRunReport,
  insertAfter,
  moveCabinetToOffset,
  reorderRunTight,
} from "./run-operations";

export type {
  CabinetCategory,
  CabinetLibraryEntry,
} from "./cabinet-library";
export {
  CABINET_CATEGORIES,
  CABINET_LIBRARY,
  filterLibraryByCategory,
  getCabinetLibraryEntry,
  getUnionOfWidthPresets,
  searchLibrary,
} from "./cabinet-library";

export type {
  DoorConfig,
  DrawerBankIntent,
  DrawerHeightPattern,
  ShelfIntent,
  ShelfPolicy,
} from "./interior-intent";
export {
  readDoorConfig,
  readDrawerBankIntent,
  readShelfIntent,
  withDoorConfig,
  withDrawerBankIntent,
  withShelfIntent,
} from "./interior-intent";

export type { LayoutIssue, LayoutIssueCode, DesignReadiness } from "./layout-validation";
export { summarizeDesignReadiness, validateRoomLayout } from "./layout-validation";
