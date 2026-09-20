// Public API for the Phase 2 cabinet-systems domain.

export type {
  CabinetFamilyRuleField,
  CabinetFamilyRuleFields,
  CabinetFamilyRuleRow,
  CabinetSystemAssignments,
  CabinetSystemRefKey,
  CornerVariant,
  DrawerBoxJoinery,
  DrawerSystemField,
  DrawerSystemFields,
  DrawerSystemKind,
  DrawerSystemResolution,
  DrawerSystemRow,
  FamilyResolution,
  FamilyResolutionSource,
  FamilyResolutionStatus,
  FixedShelfPolicy,
  FrontSystemField,
  FrontSystemFields,
  FrontSystemKind,
  FrontSystemResolution,
  FrontSystemRole,
  FrontSystemRow,
  HardwareCategory,
  HardwareProvenanceSource,
  HardwareRequirement,
  HardwareRequirementProvenance,
  HardwareResolution,
  HardwareUnit,
  Phase2ReadinessCode,
  QuantityStatus,
  SystemResolutionSource,
  SystemResolutionStatus,
  SystemRowMetadata,
} from "./types";
export {
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
} from "./types";

export {
  cabinetFamilyRuleCreateSchema,
  cabinetFamilyRulePatchSchema,
  cabinetSystemAssignmentsFullSchema,
  cabinetSystemAssignmentsPatchSchema,
  drawerSystemCreateSchema,
  drawerSystemPatchSchema,
  frontSystemCreateSchema,
  frontSystemPatchSchema,
  type CabinetFamilyRuleCreateInput,
  type CabinetFamilyRulePatchInput,
  type CabinetSystemAssignmentsFull,
  type CabinetSystemAssignmentsPatch,
  type DrawerSystemCreateInput,
  type DrawerSystemPatchInput,
  type FrontSystemCreateInput,
  type FrontSystemPatchInput,
} from "./schemas";

export {
  mergeCabinetSystemAssignments,
  mergeMetadataAssignmentsPatch,
  readAssignmentsFromMetadata,
} from "./assignments";

export {
  assertSameOrg,
  pickFamilyRuleIdForType,
  resolveCabinetFamilyRule,
  resolveDrawerSystem,
  resolveFrontSystem,
  type DrawerSystemResolverInput,
  type FamilyResolverInput,
  type FrontSystemResolverInput,
} from "./resolver";

export {
  resolveHardwareRequirements,
  type HardwareResolutionInput,
  type HardwareResolutionOutput,
} from "./hardware-resolution";

export {
  assertSystemBelongsToOrg,
  type SystemTenancyCheckErr,
  type SystemTenancyCheckOk,
  type SystemTenancyCheckResult,
} from "./tenancy";

export { buildDrawerSystemCandidate } from "./patch";
