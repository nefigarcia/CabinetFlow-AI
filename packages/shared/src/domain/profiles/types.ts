// Profile-inheritance types (Phase 1). Field-level inheritance across
// Organization → Project → Room → Cabinet, with per-field provenance.
//
// Phase 1: metadata + readiness only. compileUnit, CAD service, DXF,
// CNC pipelines are NOT wired to these profiles. Existing hardcoded
// compiler defaults remain authoritative.

export type ProfileKind = "construction" | "material" | "hardware";

export type ProfileSource =
  | "organization"
  | "project"
  | "room"
  | "cabinet";

/** Ordered LOW → HIGH precedence. Iteration order matters at merge time. */
export const SCOPE_PRECEDENCE: readonly ProfileSource[] = [
  "organization",
  "project",
  "room",
  "cabinet",
] as const;

// ─── Row-level verification (summary on the profile ROW) ───────────────────

export const VERIFICATION_STATUSES = [
  "verified",
  "partially_verified",
  "project_specific",
  "unverified",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// ─── Field-level verification (per-field on each row) ──────────────────────
//
// `partially_verified` is deliberately NOT a field-level status — that
// concept applies to the ROW (some of its fields verified, some not).
// A single field is always one of these three.

export const FIELD_VERIFICATION_STATUSES = [
  "verified",
  "project_specific",
  "unverified",
] as const;
export type FieldVerificationStatus = (typeof FIELD_VERIFICATION_STATUSES)[number];

export interface FieldProvenance {
  status:    FieldVerificationStatus;
  sourceRef?: string | null;
}

/** JSON persisted in the `fieldProvenance` LONGTEXT column. Keys are
 *  field names on the owning profile kind. Unknown keys are allowed
 *  (loose schema at the API boundary) but IGNORED by the resolver. */
export type FieldProvenanceMap = Record<string, FieldProvenance>;

// ─── Effective verification result (per field, after merge) ────────────────

export type FieldVerification =
  | { status: FieldVerificationStatus; profileSource: ProfileSource; sourceRef: string | null }
  | { status: "unknown" };

// ─── Row shapes (aligned to Prisma models, decimals as number for math) ────

/** Fields the ConstructionProfile row exposes to the merger. */
export interface ConstructionProfileFields {
  constructionMethod:          "face_frame" | "frameless" | null;
  frontOverlayMode:            "inset" | "partial_overlay" | "full_overlay" | null;
  carcassThicknessMm:          number | null;
  drawerBoxThicknessMm:        number | null;
  drawerBoxJoinery:            string | null;
  backThicknessMm:             number | null;
  adjustableShelfThicknessMm:  number | null;
  nailerThicknessMm:           number | null;
}

/** Fields the CabinetMaterialProfile row exposes to the merger. */
export interface CabinetMaterialProfileFields {
  carcassMaterialSpec:            string | null;
  drawerBoxMaterialSpec:          string | null;
  faceFrameMaterialSpec:          string | null;
  doorMaterialSpec:               string | null;
  shelfMaterialSpec:              string | null;
  backMaterialSpec:               string | null;
  adjustableShelfMaterialSpec:    string | null;
  nailerMaterialSpec:             string | null;
}

/** Fields the HardwareProfile row exposes to the merger. */
export interface HardwareProfileFields {
  hingeManufacturer:          string | null;
  hingeSoftClose:             boolean | null;
  hingeSystem:                string | null;
  drawerSlideManufacturer:    string | null;
  drawerSlideSoftClose:       boolean | null;
  drawerSlideSystem:          string | null;
}

/** Ancillary row metadata that travels alongside every merge. */
export interface ProfileRowMetadata {
  id: string;
  verificationStatus: VerificationStatus;
  sourceRef: string | null;
  fieldProvenance: FieldProvenanceMap | null;
  metadata: Record<string, unknown> | null;
}

// Convenience row types combining fields + metadata. Used by API
// serializers and the resolver's `contributions` input.
export type ConstructionProfileRow = ConstructionProfileFields & ProfileRowMetadata;
export type CabinetMaterialProfileRow = CabinetMaterialProfileFields & ProfileRowMetadata;
export type HardwareProfileRow = HardwareProfileFields & ProfileRowMetadata;

// ─── Canonical field lists ─────────────────────────────────────────────────
//
// The merger + strict provenance schemas iterate ONLY these keys. New
// fields land here in the same PR that adds the column (which forces
// the migration + resolver + tests to stay in sync).

export const CONSTRUCTION_FIELDS = [
  "constructionMethod",
  "frontOverlayMode",
  "carcassThicknessMm",
  "drawerBoxThicknessMm",
  "drawerBoxJoinery",
  "backThicknessMm",
  "adjustableShelfThicknessMm",
  "nailerThicknessMm",
] as const satisfies readonly (keyof ConstructionProfileFields)[];

export const MATERIAL_FIELDS = [
  "carcassMaterialSpec",
  "drawerBoxMaterialSpec",
  "faceFrameMaterialSpec",
  "doorMaterialSpec",
  "shelfMaterialSpec",
  "backMaterialSpec",
  "adjustableShelfMaterialSpec",
  "nailerMaterialSpec",
] as const satisfies readonly (keyof CabinetMaterialProfileFields)[];

export const HARDWARE_FIELDS = [
  "hingeManufacturer",
  "hingeSoftClose",
  "hingeSystem",
  "drawerSlideManufacturer",
  "drawerSlideSoftClose",
  "drawerSlideSystem",
] as const satisfies readonly (keyof HardwareProfileFields)[];

export type ConstructionField = (typeof CONSTRUCTION_FIELDS)[number];
export type MaterialField     = (typeof MATERIAL_FIELDS)[number];
export type HardwareField     = (typeof HARDWARE_FIELDS)[number];
