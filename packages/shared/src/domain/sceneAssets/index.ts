// Public surface of the Scene Asset domain (Slice 1 foundation).
//
// Scene Assets are reusable visualization / reference objects — furniture,
// appliances, plumbing fixtures, decor. They complement, but never replace,
// the Cabinet Domain. Any object that participates in manufacturing (parts,
// cut list, CNC) MUST remain a Cabinet Domain object; do not shortcut it as
// a Scene Asset.

export type { SceneAssetCategory } from "./scene-asset-category";
export {
  SCENE_ASSET_CATEGORIES,
  SCENE_ASSET_CATEGORY_LABELS,
  sceneAssetCategorySchema,
} from "./scene-asset-category";

export type { SceneAssetPlacement } from "./scene-asset-placement";
export {
  DEFAULT_PLACEMENT,
  isCeilingMounted,
  isCountertopMounted,
  isFloorMounted,
  isWallMounted,
  sceneAssetPlacementSchema,
} from "./scene-asset-placement";

export type { SceneAssetCollision } from "./scene-asset-collision";
export {
  DEFAULT_COLLISION,
  sceneAssetCollisionSchema,
} from "./scene-asset-collision";

export type {
  SceneAssetDefinition,
  SceneAssetDimensionsMm,
  SceneAssetModelNormalization,
  SceneAssetModelRef,
} from "./scene-asset-definition";
export {
  hasModel,
  sceneAssetDefinitionSchema,
  sceneAssetDimensionsMmSchema,
  sceneAssetModelRefSchema,
} from "./scene-asset-definition";

export type {
  NormalizedInstanceCreate,
  SceneAssetInstance,
  SceneAssetInstanceCreateInput,
  SceneAssetInstanceUpdateInput,
  Vec3,
} from "./scene-asset-instance";
export {
  IDENTITY_ROTATION,
  IDENTITY_SCALE,
  SCENE_ASSET_INSTANCE_SCHEMA_VERSION,
  sceneAssetInstanceCreateSchema,
  sceneAssetInstanceSchema,
  sceneAssetInstanceUpdateSchema,
  vec3Schema,
  withInstanceDefaults,
} from "./scene-asset-instance";

export type { SceneAssetCatalog } from "./scene-asset-catalog";
export { createSceneAssetCatalog } from "./scene-asset-catalog";

export type { PrimitiveShape } from "./primitive-shape";
export {
  categoryDefaultPrimitiveShape,
  getPrimitiveShape,
} from "./primitive-shape";

export type { SceneAssetInstancePatch } from "./instance-reducers";
export {
  addInstance,
  clearInstances,
  removeInstance,
  updateInstance,
} from "./instance-reducers";

export { DEFAULT_SCENE_ASSET_CATALOG } from "./default-catalog";

export { filterInstancesForRoom } from "./room-filter";

export type { DuplicateInstanceOptions } from "./duplicate-instance";
export {
  DEFAULT_DUPLICATE_OFFSET_MM_X,
  duplicateSceneAssetInstance,
} from "./duplicate-instance";

export type { SceneAssetSelectionDecision } from "./selection-transitions";
export { sceneAssetSelectionAfterRoomChange } from "./selection-transitions";

export type { RoomType } from "./room-type";
export {
  getRoomType,
  normalizeRoomType,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
} from "./room-type";

export {
  getRecommendedCategoriesForRoomType,
  ROOM_TYPE_RECOMMENDED_CATEGORIES,
} from "./room-type-catalog-policy";

export {
  filterCatalogByCategory,
  filterCatalogForRoomType,
  searchCatalog,
} from "./catalog-filters";

export type {
  GetDefaultPlacementInput,
  PlacementResult,
  PlacementTransform,
  PlacementWarning,
  PlacementWarningCode,
} from "./default-placement";
export { getDefaultSceneAssetPlacement } from "./default-placement";

export type { AABB, Vec3Mm } from "./aabb";
export {
  aabbIntersects,
  getSceneAssetAabb,
  getSceneAssetClearanceAabb,
  inflateAabb,
} from "./aabb";

export type { RoomBoundsMm, RoomBoundsViolation } from "./room-bounds";
export {
  aabbBottomCenter,
  getRoomBoundsAabb,
  getRoomBoundsOverhang,
  getRoomBoundsViolations,
  isInsideRoomBounds,
  ROOM_BOUNDS_VIOLATION_LABELS,
} from "./room-bounds";

export type {
  SpatialValidationCode,
  SpatialValidationIssue,
  ValidatePlacementInput,
} from "./spatial-validation";
export { validateSceneAssetPlacement } from "./spatial-validation";

export type {
  NormalizationTransform,
  RawBboxM,
} from "./glb-normalization";
export { computeNormalizationTransform } from "./glb-normalization";
