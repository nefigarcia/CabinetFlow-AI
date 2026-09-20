// Phase 2 domain types — cabinet family rules, front systems, drawer
// systems, hardware requirements. Metadata + readiness only.
//
// Phase 2 does NOT wire any of this into compileUnit, CAD service,
// syncParts, DXF, CNC, sheet nesting, G-code, or calculateHardwareBom.
// Existing hardcoded compiler + BOM behavior remains authoritative.

import type { CabinetType } from "../../types/cabinet";

// ─── HARDWARE TYPES ─────────────────────────────────────────────────────────
//
// The canonical, single source of truth for `Hardware.type` and the
// legacy BOM aggregator. Phase 2 semantic HardwareResolution is bound
// to this exact vocabulary. Extending this list would require a
// migration + BOM aggregator update — out of Phase 2 scope.

export const HARDWARE_TYPES = [
  "hinge",
  "drawer_slide",
  "handle",
  "screw",
  "cam_lock",
  "shelf_pin",
  "soft_close",
  "other",
] as const;
export type HardwareCategory = (typeof HARDWARE_TYPES)[number];

// ─── CABINET FAMILY RULE ───────────────────────────────────────────────────

/** Fields the CabinetFamilyRule row exposes. Structural + geometric
 *  policy per cabinet family. NEVER wired to compileUnit. */
export interface CabinetFamilyRuleFields {
  cabinetType: CabinetType;

  hasToeKick:       boolean | null;
  hasBack:          boolean | null;
  hasNailer:        boolean | null;
  fixedShelfPolicy: FixedShelfPolicy | null;
  cornerVariant:    CornerVariant | null;

  toeHeightMm:    number | null;
  toeRecessMm:    number | null;
  topRevealMm:    number | null;
  bottomRevealMm: number | null;
  topScribeMm:    number | null;
  bottomScribeMm: number | null;
}

export const FIXED_SHELF_POLICIES = ["none", "structural", "optional"] as const;
export type FixedShelfPolicy = (typeof FIXED_SHELF_POLICIES)[number];

export const CORNER_VARIANTS = ["blind_left", "blind_right", "l_corner"] as const;
export type CornerVariant = (typeof CORNER_VARIANTS)[number];

/** Canonical field list — used by the resolver, strict provenance
 *  schemas, and stale-cleanup normalization. */
export const CABINET_FAMILY_RULE_FIELDS = [
  "cabinetType",
  "hasToeKick",
  "hasBack",
  "hasNailer",
  "fixedShelfPolicy",
  "cornerVariant",
  "toeHeightMm",
  "toeRecessMm",
  "topRevealMm",
  "bottomRevealMm",
  "topScribeMm",
  "bottomScribeMm",
] as const satisfies readonly (keyof CabinetFamilyRuleFields)[];
export type CabinetFamilyRuleField = (typeof CABINET_FAMILY_RULE_FIELDS)[number];

// ─── FRONT SYSTEM ──────────────────────────────────────────────────────────

export const FRONT_SYSTEM_KINDS = [
  "hinged_single",
  "hinged_double",
  "bifold",
  "pocket",
  "open",
  "fixed_panel",
] as const;
export type FrontSystemKind = (typeof FRONT_SYSTEM_KINDS)[number];

export const FRONT_SYSTEM_ROLES = ["cabinet_front", "appliance_panel"] as const;
export type FrontSystemRole = (typeof FRONT_SYSTEM_ROLES)[number];

export interface FrontSystemFields {
  kind:      FrontSystemKind;
  role:      FrontSystemRole;
  glassFlag: boolean;
}

export const FRONT_SYSTEM_FIELDS = [
  "kind",
  "role",
  "glassFlag",
] as const satisfies readonly (keyof FrontSystemFields)[];
export type FrontSystemField = (typeof FRONT_SYSTEM_FIELDS)[number];

// ─── DRAWER SYSTEM ─────────────────────────────────────────────────────────
//
// Discriminated on `kind`:
//   traditional  → box{Side,Bottom,Back,SubFront}ThicknessMm + boxJoinery populated,
//                  proprietaryFamily is null
//   proprietary  → proprietaryFamily populated, all box* fields are null

export const DRAWER_SYSTEM_KINDS = ["traditional", "proprietary"] as const;
export type DrawerSystemKind = (typeof DRAWER_SYSTEM_KINDS)[number];

export const DRAWER_BOX_JOINERIES = [
  "dovetail",
  "dowel",
  "confirmat",
  "rabbet_dado",
  "butt_screw",
] as const;
export type DrawerBoxJoinery = (typeof DRAWER_BOX_JOINERIES)[number];

export interface DrawerSystemFields {
  kind: DrawerSystemKind;

  boxSideThicknessMm:     number | null;
  boxBottomThicknessMm:   number | null;
  boxBackThicknessMm:     number | null;
  boxSubFrontThicknessMm: number | null;
  boxJoinery:             DrawerBoxJoinery | null;

  proprietaryFamily: string | null;
}

export const DRAWER_SYSTEM_FIELDS = [
  "kind",
  "boxSideThicknessMm",
  "boxBottomThicknessMm",
  "boxBackThicknessMm",
  "boxSubFrontThicknessMm",
  "boxJoinery",
  "proprietaryFamily",
] as const satisfies readonly (keyof DrawerSystemFields)[];
export type DrawerSystemField = (typeof DRAWER_SYSTEM_FIELDS)[number];

// ─── Row metadata (mirrors Phase 1 ProfileRowMetadata) ─────────────────────

import type {
  FieldProvenanceMap,
  ProfileSource,
  VerificationStatus,
} from "../profiles/types";

export interface SystemRowMetadata {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  verificationStatus: VerificationStatus;
  verificationGaps: string[] | null;
  sourceRef: string | null;
  fieldProvenance: FieldProvenanceMap | null;
  metadata: Record<string, unknown> | null;
}

export type CabinetFamilyRuleRow = CabinetFamilyRuleFields & SystemRowMetadata;
export type FrontSystemRow       = FrontSystemFields & SystemRowMetadata;
export type DrawerSystemRow      = DrawerSystemFields & SystemRowMetadata;

// ─── Assignments (JSON blob under Organization/Project/Room.metadata) ──────
//
// Shape shared across Org / Project / Room.
//   familyRuleIdsByCabinetType — per-CabinetType map
//   preferredFrontSystemId / preferredDrawerSystemId — singular

export interface CabinetSystemAssignments {
  familyRuleIdsByCabinetType?: Partial<Record<CabinetType, string>>;
  preferredFrontSystemId?: string;
  preferredDrawerSystemId?: string;
}

/** Reserved keys on Cabinet.parameters for Phase 2 cabinet-level overrides. */
export const CABINET_SYSTEM_REF_KEYS = [
  "familyRuleId",
  "frontSystemId",
  "drawerSystemId",
] as const;
export type CabinetSystemRefKey = (typeof CABINET_SYSTEM_REF_KEYS)[number];

/** The single boolean flag on Cabinet.parameters that intentionally
 *  short-circuits family-rule inheritance. See resolver for semantics. */
export const CABINET_DISABLE_FAMILY_RULE_KEY = "disableFamilyRule" as const;

// ─── Resolution results ────────────────────────────────────────────────────

export type FamilyResolutionStatus = "resolved" | "unresolved" | "disabled";
export type SystemResolutionStatus = "resolved" | "unresolved";

export type FamilyResolutionSource =
  | "cabinet"
  | "room"
  | "project"
  | "organization"
  | "cabinet_disabled"
  | "none";

export type SystemResolutionSource =
  | "cabinet"
  | "room"
  | "project"
  | "organization"
  | "none";

export interface FamilyResolution {
  rule:   CabinetFamilyRuleRow | null;
  status: FamilyResolutionStatus;
  source: FamilyResolutionSource;
}

export interface FrontSystemResolution {
  system: FrontSystemRow | null;
  status: SystemResolutionStatus;
  source: SystemResolutionSource;
}

export interface DrawerSystemResolution {
  system: DrawerSystemRow | null;
  status: SystemResolutionStatus;
  source: SystemResolutionSource;
}

// ─── HardwareRequirement / HardwareResolution ──────────────────────────────

export const HARDWARE_UNITS = ["piece", "pair", "set"] as const;
export type HardwareUnit = (typeof HARDWARE_UNITS)[number];

export const QUANTITY_STATUSES = ["verified", "unresolved"] as const;
export type QuantityStatus = (typeof QUANTITY_STATUSES)[number];

export const HARDWARE_PROVENANCE_SOURCES = [
  "profile",
  "system",
  "family_rule",
  "build_sheet_fixture",
  "default",
] as const;
export type HardwareProvenanceSource = (typeof HARDWARE_PROVENANCE_SOURCES)[number];

export interface HardwareRequirementProvenance {
  source: HardwareProvenanceSource;
  detail: string;
}

export interface HardwareRequirement {
  category: HardwareCategory;
  familyHint: string | null;
  quantity: number;
  unit: HardwareUnit;
  quantityStatus: QuantityStatus;
  requirements: {
    softClose?: boolean;
  };
  spec: Record<string, unknown>;
  provenance: HardwareRequirementProvenance;
}

export interface HardwareResolution {
  requirements: HardwareRequirement[];
  deferred: boolean;
  deferReason?: string;
}

// ─── Phase 2 readiness codes ───────────────────────────────────────────────
//
// All warning-only. Disabled family state is represented directly on
// FamilyResolution and does NOT fire a readiness code (per v4.1 §5).

export const PHASE2_READINESS_CODES = [
  "CABINET_FAMILY_RULE_UNRESOLVED",
  "FRONT_SYSTEM_UNRESOLVED",
  "DRAWER_SYSTEM_UNRESOLVED",
  "HARDWARE_RULE_UNRESOLVED",
  "HARDWARE_QUANTITY_UNRESOLVED",
  "SYSTEM_CAPABILITY_DEFERRED",
  "SYSTEM_UNCOMMON_COMBO",
] as const;
export type Phase2ReadinessCode = (typeof PHASE2_READINESS_CODES)[number];

// Re-export for consumers that want ProfileSource without importing profiles.
export type { ProfileSource };
