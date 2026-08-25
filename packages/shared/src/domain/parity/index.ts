// Public surface of the Geometry Parity harness (V2.1A).
//
// This module is DIAGNOSTIC-ONLY. Nothing in here modifies production
// behavior. It exists to make the current divergence between the
// TypeScript geometry compiler and the Python cad-service measurable and
// visible so that V2.1B can normalize against verified shop standards.

export type {
  CabinetTypeScope,
  InventoryCategory,
  InventoryEntry,
  ParityStatus,
  ParityUnit,
  SourceRef,
} from "./inventory";
export {
  GEOMETRY_ASSUMPTION_INVENTORY,
  entriesByCategory,
  entriesByStatus,
  findEntry,
  inventoryStatusCounts,
  pyNumericValue,
  tsNumericValue,
} from "./inventory";

export {
  GEOMETRY_COMPARE_TOLERANCE_MM,
  RATIO_COMPARE_TOLERANCE,
  deltaMm,
  nearlyEqualMm,
  nearlyEqualRatio,
} from "./tolerance";

export type {
  BoundingBoxMm,
  GeometryParitySnapshot,
  SnapshotBoringPoint,
  SnapshotCountertop,
  SnapshotFaceFrame,
  SnapshotFront,
  SnapshotPart,
  SnapshotShelfPin,
  SnapshotSource,
  SnapshotToeKick,
  Vec3Mm as SnapshotVec3Mm,
} from "./snapshot";
export { geometryParitySnapshotSchema, sortSnapshotParts } from "./snapshot";

export { buildTypeScriptSnapshot } from "./snapshot-typescript";
export { buildPythonPredictedSnapshot } from "./snapshot-python-predicted";

export type {
  DiffSeverity,
  FieldDiff,
  PartRoleDiff,
  SnapshotDiff,
} from "./diff";
export { diffSnapshots } from "./diff";

export { formatSnapshotDiffReport } from "./report";

export type { ParityFixture } from "./fixtures";
export { PARITY_FIXTURES, findFixture } from "./fixtures";
