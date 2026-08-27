// Cabinet Domain Engine V2 — foundation.
//
// Public surface of the intent-only cabinet design domain. Nothing in here
// depends on Prisma, the geometry compiler, the API layer, or any Python
// service; it is safe to import from any workspace.
//
// Callers wanting derived manufacturing geometry go through:
//   (CabinetDesignDocumentV1 + ResolvedConfiguration) → parametric engine → CompiledGeometry
// The parametric engine is intentionally not part of this foundation module.

export {
  CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION,
  cabinetDesignDocumentV1Schema,
  parseCabinetDesignDocumentV1,
  serializeCabinetDesignDocumentV1,
} from "./design-document";

export type {
  CabinetConstraint,
  CabinetDesign,
  CabinetDesignDocumentV1,
  CabinetDimensionsMm,
  CabinetIntentParameters,
  CabinetOverrides,
  CabinetRole,
  ConstructionProfileRef,
  DesignDefaults,
  HardwareProfileRef,
  MaterialProfileRef,
  PartDesign,
  PartDimensionsMm,
  PartEdgeBanding,
  PartGrainDirection,
  PartOverrides,
  ProfileRef,
  RoomDesign,
  RoomDimensionsMm,
  Units,
  Vec3Mm,
} from "./design-document";

export type {
  ConstructionMethod,
  ConstructionProfile,
  JoineryKind,
  OverlayKind,
} from "./profiles/construction";
export {
  constructionProfileSchema,
  createLegacyCadProfile,
  createLegacyFaceFrameProfile,
  createLegacyVisualProfile,
} from "./profiles/construction";

export type {
  EdgeBandingRule,
  FinishSpec,
  GrainDirection,
  ManufacturerRef,
  MaterialProfile,
  MaterialType,
} from "./profiles/material";
export { materialProfileSchema } from "./profiles/material";

export type {
  DrawerSlideSpec,
  HardwareProfile,
  HingeSpec,
  PullSpec,
  ShelfPinHardwareSpec,
} from "./profiles/hardware";
export { hardwareProfileSchema } from "./profiles/hardware";

export type { PartGenerationMode } from "./parts/generation-mode";
export {
  isFullyLocked,
  isFullyRegeneratable,
  isProtectedFromRegeneration,
  legacyIsManualFromGenerationMode,
  partGenerationModeFromLegacyIsManual,
  partGenerationModeSchema,
} from "./parts/generation-mode";

export type {
  ProfileVersionSnapshot,
  ValidationIssue,
  ValidationReportV2,
  ValidationSeverity,
  ValidationSource,
} from "./validation/issue";
export {
  hasBlockingIssue,
  highestSeverity,
  issuesBySource,
  validationIssueSchema,
  validationReportV2Schema,
} from "./validation/issue";

export type {
  FieldSource,
  OrganizationDefaults,
  ProfileRegistry,
  ProjectDefaults,
  ResolutionInput,
  ResolutionLevel,
  ResolutionSource,
  ResolvedConfiguration,
} from "./inheritance/resolver";
export { resolveEffectiveConfiguration } from "./inheritance/resolver";

export type { LegacyRoomLike } from "./adapters/legacy-cabinet";
export {
  adaptLegacyCabinet,
  adaptLegacyPart,
  adaptLegacyRoom,
} from "./adapters/legacy-cabinet";

export type {
  LegacySnapshotPart,
  PartCreateInput,
} from "./adapters/revision-snapshot";
export { snapshotPartToPrismaData } from "./adapters/revision-snapshot";

export { LEGACY_PARTS_REGENERATION_FILTER } from "./adapters/legacy-part-sync";

// Geometry Parity harness (V2.1A). Diagnostic-only.
export * from "./parity";

// Material & Texture Rendering MVP (V2.6.0). Browser-render-only domain.
export * from "./materials";

// Scene Asset Domain (Slice 1). Visualization / reference objects that
// complement — but never replace — the Cabinet Domain.
export * from "./sceneAssets";

// Room Architecture Engine. Deterministic walls/floor/ceiling/openings.
// Independent of Cabinet Domain and Scene Assets — defines the space
// they are placed inside.
export * from "./architecture";
