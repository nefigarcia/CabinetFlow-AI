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

// Cabinet Design domain — cabinet ↔ wall attachment, runs, chained
// placement, layout validation. Sits between architecture (walls) and
// the manufacturing compiler (types/geometry.ts); never touches the
// compiler and never generates parts.
export * from "./cabinets";

// Profile Inheritance domain (Phase 1). Persistent construction /
// material / hardware profiles with field-level inheritance, per-field
// provenance, verification gaps, and deferred-capability metadata.
// Metadata + readiness only in Phase 1 — never wired into compileUnit,
// CAD service, DXF, CNC, or nesting.
//
// Exposed BOTH as a namespace (for tests + docs) and as specific
// top-level re-exports. The specific names below are distinct from the
// older intent-only ConstructionProfile / MaterialProfile /
// HardwareProfile schemas exported directly above (which describe the
// Cabinet Design intent model, not persistent shop profiles).
export * as ProfileInheritance from "./profiles";

// Cabinet Systems domain (Phase 2). Family rules, front / drawer
// systems, semantic HardwareResolution, cabinet-system assignment
// merge + resolver. Metadata + readiness only — NEVER wired into
// compileUnit, CAD service, syncParts, DXF, CNC, sheet nesting,
// G-code, or the legacy calculateHardwareBom.
export * as CabinetSystems from "./systems";
export {
  // vocabularies + field lists
  CABINET_DISABLE_FAMILY_RULE_KEY,
  CABINET_FAMILY_RULE_FIELDS,
  CABINET_SYSTEM_REF_KEYS,
  CORNER_VARIANTS,
  DRAWER_BOX_JOINERIES,
  DRAWER_SYSTEM_FIELDS,
  DRAWER_SYSTEM_KINDS,
  FIXED_SHELF_POLICIES,
  FRONT_SYSTEM_FIELDS,
  FRONT_SYSTEM_KINDS,
  FRONT_SYSTEM_ROLES,
  HARDWARE_PROVENANCE_SOURCES,
  HARDWARE_TYPES,
  HARDWARE_UNITS,
  PHASE2_READINESS_CODES,
  QUANTITY_STATUSES,
  // Zod schemas
  cabinetFamilyRuleCreateSchema,
  cabinetFamilyRulePatchSchema,
  cabinetSystemAssignmentsFullSchema,
  cabinetSystemAssignmentsPatchSchema,
  drawerSystemCreateSchema,
  drawerSystemPatchSchema,
  frontSystemCreateSchema,
  frontSystemPatchSchema,
  // assignments
  mergeCabinetSystemAssignments,
  mergeMetadataAssignmentsPatch,
  readAssignmentsFromMetadata,
  // resolvers
  assertSameOrg,
  pickFamilyRuleIdForType,
  resolveCabinetFamilyRule,
  resolveDrawerSystem,
  resolveFrontSystem,
  // hardware resolution
  resolveHardwareRequirements,
  // tenancy
  assertSystemBelongsToOrg,
  // patch candidate builder
  buildDrawerSystemCandidate,
  // authorization
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
  canAssignCabinetSystems,
  canManageOrganizationStandards,
  canReadCabinetSystems,
  // readiness relevance
  isDrawerSystemRelevant,
  // types
  type CabinetFamilyRuleCreateInput,
  type DrawerRelevanceInput,
  type CabinetFamilyRuleField,
  type CabinetFamilyRuleFields,
  type CabinetFamilyRulePatchInput,
  type CabinetFamilyRuleRow,
  type CabinetSystemAssignments,
  type CabinetSystemAssignmentsFull,
  type CabinetSystemAssignmentsPatch,
  type CabinetSystemRefKey,
  type CornerVariant,
  type DrawerBoxJoinery,
  type DrawerSystemCreateInput,
  type DrawerSystemField,
  type DrawerSystemFields,
  type DrawerSystemKind,
  type DrawerSystemPatchInput,
  type DrawerSystemResolution,
  type DrawerSystemResolverInput,
  type DrawerSystemRow,
  type FamilyResolution,
  type FamilyResolutionSource,
  type FamilyResolutionStatus,
  type FamilyResolverInput,
  type FixedShelfPolicy,
  type FrontSystemCreateInput,
  type FrontSystemField,
  type FrontSystemFields,
  type FrontSystemKind,
  type FrontSystemPatchInput,
  type FrontSystemResolution,
  type FrontSystemResolverInput,
  type FrontSystemRole,
  type FrontSystemRow,
  type HardwareCategory,
  type HardwareProvenanceSource,
  type HardwareRequirement,
  type HardwareRequirementProvenance,
  type HardwareResolution,
  type HardwareResolutionInput,
  type HardwareResolutionOutput,
  type HardwareUnit,
  type Phase2ReadinessCode,
  type QuantityStatus,
  type SystemResolutionSource,
  type SystemResolutionStatus,
  type SystemRowMetadata,
  type SystemTenancyCheckErr,
  type SystemTenancyCheckOk,
  type SystemTenancyCheckResult,
} from "./systems";
export {
  // types + canonical field lists
  CONSTRUCTION_FIELDS,
  FIELD_VERIFICATION_STATUSES,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  SCOPE_PRECEDENCE,
  VERIFICATION_STATUSES,
  // Zod schemas
  assignProfilesToOrgSchema,
  assignProfilesToProjectSchema,
  assignProfilesToRoomSchema,
  cabinetMaterialProfileWriteSchema,
  constructionProfileWriteSchema,
  fieldProvenanceMapSchema,
  fieldProvenanceSchema,
  fieldVerificationStatusSchema,
  hardwareProfileWriteSchema,
  makeStrictFieldProvenanceMapSchema,
  nullableMetadataSchema,
  verificationGapsSchema,
  verificationStatusSchema,
  // gap vocabulary
  CANONICAL_GAP_KEYS,
  GAP_FIELD_MAP,
  // resolvers + effective helpers
  effectiveDeferredCapabilities,
  effectiveFieldVerification,
  effectiveVerificationGaps,
  mergeProfileFields,
  // deferred capabilities
  DEFERRED_CAPABILITIES,
  DEFERRED_CAPABILITY_STATUSES,
  deferredCapabilitiesArraySchema,
  deferredCapabilitySchema,
  makeStrictDeferredCapabilitiesSchema,
  readDeferredCapabilities,
  // patch semantics
  buildPartialPrismaUpdate,
  normalizeStaleFieldProvenance,
  // tenancy
  assertProfileBelongsToOrg,
  // types
  type AssignProfilesToOrgInput,
  type AssignProfilesToProjectInput,
  type AssignProfilesToRoomInput,
  type CabinetMaterialProfileFields,
  type CabinetMaterialProfileRow,
  type CabinetMaterialProfileWriteInput,
  type ConstructionField,
  type ConstructionProfileFields,
  type ConstructionProfileRow,
  type ConstructionProfileWriteInput,
  type DeferredCapability,
  type DeferredCapabilityContribution,
  type DeferredCapabilityName,
  type DeferredCapabilityStatus,
  type EffectiveDeferredCapability,
  type EffectiveProfile,
  type EffectiveProfileBundle,
  type FieldProvenance,
  type FieldProvenanceMap,
  type FieldVerification,
  type FieldVerificationStatus,
  type GapEvaluationPurpose,
  type GapMapping,
  type GapResolutionInput,
  type GapResolutionResult,
  type HardwareField,
  type HardwareProfileFields,
  type HardwareProfileRow,
  type HardwareProfileWriteInput,
  type MaterialField,
  type ProfileKind,
  type ProfileRowMetadata,
  type ProfilesBySourceBundle,
  type ProfileSource,
  type ScopeContribution,
  type TenancyCheckErr,
  type TenancyCheckOk,
  type TenancyCheckResult,
  type VerificationStatus,
} from "./profiles";

// Interior Components domain (Phase 3.0). Typed intent for interior
// accessories (rollouts, trash pullouts, dividers, hidden drawers,
// spice racks, etc.). Metadata + readiness only — NEVER wired into
// compileUnit, CAD service, syncParts, DXF, CNC, sheet nesting,
// G-code, or calculateHardwareBom in Phase 3.0.
export * as InteriorComponents from "./interiorComponents";
export {
  // vocabularies
  INTERIOR_COMPONENT_TYPES,
  INTERIOR_COMPONENT_VERIFICATION_STATUSES,
  INTERIOR_READINESS_CODES,
  INTERIOR_TARGET_KINDS,
  // Zod schemas
  cabinetInteriorComponentSchema,
  cabinetInteriorComponentsArraySchema,
  interiorComponentTargetSchema,
  // engine
  evaluateInteriorComponentsReadiness,
  // patch helpers
  INTERIOR_COMPONENTS_PARAM_KEY,
  addInteriorComponent,
  buildInteriorComponentsPatch,
  readInteriorComponents,
  removeInteriorComponent,
  reorderInteriorComponents,
  setInteriorComponentEnabled,
  updateInteriorComponent,
  // ID helper
  isValidInteriorComponentId,
  newInteriorComponentId,
  // AI operation schema
  assertUpdateOperationInvariant,
  interiorComponentOperationSchema,
  // server-side incoming-parameters validation
  validateIncomingCabinetParameters,
  type IncomingParametersValidationResult,
  // types
  type CabinetInteriorComponent,
  type CabinetInteriorComponentsArray,
  type CustomInteriorComponent,
  type DrawerDividerComponent,
  type HiddenDrawerComponent,
  type InteriorCabinetContext,
  type InteriorComponentOperation,
  type InteriorComponentTarget,
  type InteriorComponentType,
  type InteriorComponentVerificationStatus,
  type InteriorReadinessCode,
  type InteriorReadinessIssue,
  type InteriorTargetKind,
  type KnifeOrganizerComponent,
  type RolloutComponent,
  type SinkPulloutComponent,
  type SpiceRackComponent,
  type SpongeTiltOutComponent,
  type TrashPulloutComponent,
  type TrayDividerComponent,
  type UtensilDividerComponent,
} from "./interiorComponents";
