// Public surface of the Room Architecture Engine.
//
// Kept SEPARATE from Cabinet Domain (manufacturing geometry) and Scene
// Assets (visualization). Architecture defines the room ITSELF — walls,
// floor, ceiling, openings. Cabinets and scene assets are placed within
// the space this domain defines.

export type {
  CeilingDefinition,
  CeilingVisibility,
  DoorOpening,
  FloorDefinition,
  GenericOpening,
  RoomArchitecture,
  Vec2Mm,
  WallDefinition,
  WallOpening,
  WallOpeningType,
  WindowOpening,
} from "./types";
export { ROOM_ARCHITECTURE_SCHEMA_VERSION } from "./types";

export { roomArchitectureSchema } from "./schema";

export {
  LEGACY_WALL_IDS,
  LEGACY_WALL_THICKNESS_MM,
  deriveDefaultRoomArchitecture,
} from "./legacy-adapter";

export type { WallFrame, WallLocalPoint, WorldPointMm } from "./wall-math";
export {
  ANGLE_EPSILON,
  getWallFrame,
  getWallLengthMm,
  wallLocalToWorld,
  worldToWallLocal,
} from "./wall-math";

export type { CompiledOpening, CompiledWall, WallSegment } from "./wall-compiler";
export { compileArchitecture, compileWall } from "./wall-compiler";

export type { ArchitectureIssue, ArchitectureIssueCode } from "./validation";
export {
  validateArchitecture,
  validateOpening,
  validateWall,
} from "./validation";

export {
  ROOM_ARCHITECTURE_METADATA_KEY,
  getRoomArchitecture,
  withRoomArchitecture,
} from "./metadata-adapter";

export type { ArchitectureSpatialCode, ArchitectureSpatialIssue } from "./spatial-bridge";
export {
  getRoomFloorFootprint,
  getWallSegmentAabb,
  validateAssetAgainstArchitecture,
} from "./spatial-bridge";

export type { CabinetBridgeIssue, CabinetBridgeIssueCode } from "./cabinet-bridge";
export {
  detectCabinetsVsOpenings,
  detectSceneAssetVsCabinet,
  getCabinetAabb,
} from "./cabinet-bridge";
