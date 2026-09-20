// Public API for the profile-inheritance domain (Phase 1).

export type {
  CabinetMaterialProfileFields,
  CabinetMaterialProfileRow,
  ConstructionField,
  ConstructionProfileFields,
  ConstructionProfileRow,
  FieldProvenance,
  FieldProvenanceMap,
  FieldVerification,
  FieldVerificationStatus,
  HardwareField,
  HardwareProfileFields,
  HardwareProfileRow,
  MaterialField,
  ProfileKind,
  ProfileRowMetadata,
  ProfileSource,
  VerificationStatus,
} from "./types";
export {
  CONSTRUCTION_FIELDS,
  FIELD_VERIFICATION_STATUSES,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  SCOPE_PRECEDENCE,
  VERIFICATION_STATUSES,
} from "./types";

export {
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
  type AssignProfilesToOrgInput,
  type AssignProfilesToProjectInput,
  type AssignProfilesToRoomInput,
  type CabinetMaterialProfileWriteInput,
  type ConstructionProfileWriteInput,
  type HardwareProfileWriteInput,
} from "./schemas";

export {
  CANONICAL_GAP_KEYS,
  GAP_FIELD_MAP,
  type CanonicalGapKey,
  type GapMapping,
} from "./verification-gaps";

export type { EffectiveProfile, ScopeContribution } from "./resolver";
export {
  effectiveFieldVerification,
  mergeProfileFields,
} from "./resolver";

export type {
  EffectiveProfileBundle,
  GapEvaluationPurpose,
  GapResolutionInput,
  GapResolutionResult,
  ProfilesBySourceBundle,
} from "./gap-resolver";
export { effectiveVerificationGaps } from "./gap-resolver";

export type {
  DeferredCapability,
  DeferredCapabilityContribution,
  DeferredCapabilityName,
  DeferredCapabilityStatus,
  EffectiveDeferredCapability,
} from "./deferred-capabilities";
export {
  DEFERRED_CAPABILITIES,
  DEFERRED_CAPABILITY_STATUSES,
  deferredCapabilitiesArraySchema,
  deferredCapabilitySchema,
  effectiveDeferredCapabilities,
  makeStrictDeferredCapabilitiesSchema,
  readDeferredCapabilities,
} from "./deferred-capabilities";

export {
  buildPartialPrismaUpdate,
  normalizeStaleFieldProvenance,
} from "./patch-semantics";

export type {
  TenancyCheckErr,
  TenancyCheckOk,
  TenancyCheckResult,
} from "./tenancy";
export { assertProfileBelongsToOrg } from "./tenancy";
