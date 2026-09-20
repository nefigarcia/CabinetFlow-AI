import { z } from "zod";
import {
  CORNER_VARIANTS,
  DRAWER_BOX_JOINERIES,
  DRAWER_SYSTEM_KINDS,
  FIXED_SHELF_POLICIES,
  FRONT_SYSTEM_KINDS,
  FRONT_SYSTEM_ROLES,
} from "./types";
import {
  fieldProvenanceMapSchema,
  nullableMetadataSchema,
  verificationGapsSchema,
  verificationStatusSchema,
} from "../profiles/schemas";

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2 write schemas.
//
// Three-state PATCH semantics (undefined skip / null clear / value set)
// use the same Phase 1 primitive shapes (.nullable().optional()).
//
// For DrawerSystem the CREATE side is a discriminated union so field
// validity is enforced by kind. PATCH parses a permissive partial and
// callers (API route) run a candidate-state validation step against the
// CREATE schema after applying the patch to the existing row.
// ═══════════════════════════════════════════════════════════════════════════

const nullableString = (max: number) => z.string().max(max).nullable().optional();

const nullablePositiveDecimal = z
  .number()
  .refine((v) => Number.isFinite(v), { message: "must be finite" })
  .refine((v) => v > 0, { message: "must be positive" })
  .nullable()
  .optional();

const nullableNonNegativeDecimal = z
  .number()
  .refine((v) => Number.isFinite(v), { message: "must be finite" })
  .refine((v) => v >= 0, { message: "must be non-negative" })
  .nullable()
  .optional();

const nullableBoolean = z.boolean().nullable().optional();

const provenanceCore = {
  verificationStatus: verificationStatusSchema.optional(),
  verificationGaps:   verificationGapsSchema,
  sourceRef:          nullableString(200),
  fieldProvenance:    fieldProvenanceMapSchema.nullable().optional(),
  metadata:           nullableMetadataSchema,
};

// ─── CabinetFamilyRule ─────────────────────────────────────────────────────

const cabinetTypeSchema = z.enum([
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
]);

export const cabinetFamilyRuleCreateSchema = z.object({
  cabinetType:       cabinetTypeSchema,
  name:              z.string().min(1).max(255),
  description:       z.string().max(65_535).nullable().optional(),

  hasToeKick:        nullableBoolean,
  hasBack:           nullableBoolean,
  hasNailer:         nullableBoolean,
  fixedShelfPolicy:  z.enum(FIXED_SHELF_POLICIES).nullable().optional(),
  cornerVariant:     z.enum(CORNER_VARIANTS).nullable().optional(),

  toeHeightMm:       nullableNonNegativeDecimal,
  toeRecessMm:       nullableNonNegativeDecimal,
  topRevealMm:       nullableNonNegativeDecimal,
  bottomRevealMm:    nullableNonNegativeDecimal,
  topScribeMm:       nullableNonNegativeDecimal,
  bottomScribeMm:    nullableNonNegativeDecimal,

  ...provenanceCore,
});
export type CabinetFamilyRuleCreateInput = z.infer<typeof cabinetFamilyRuleCreateSchema>;

export const cabinetFamilyRulePatchSchema = cabinetFamilyRuleCreateSchema.partial();
export type CabinetFamilyRulePatchInput = z.infer<typeof cabinetFamilyRulePatchSchema>;

// ─── FrontSystem ───────────────────────────────────────────────────────────

export const frontSystemCreateSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(65_535).nullable().optional(),

  kind:      z.enum(FRONT_SYSTEM_KINDS),
  role:      z.enum(FRONT_SYSTEM_ROLES),
  glassFlag: z.boolean(),

  ...provenanceCore,
});
export type FrontSystemCreateInput = z.infer<typeof frontSystemCreateSchema>;

export const frontSystemPatchSchema = frontSystemCreateSchema.partial();
export type FrontSystemPatchInput = z.infer<typeof frontSystemPatchSchema>;

// ─── DrawerSystem — discriminated on kind ──────────────────────────────────

const drawerSystemHeader = {
  name:        z.string().min(1).max(255),
  description: z.string().max(65_535).nullable().optional(),
  ...provenanceCore,
};

export const drawerSystemCreateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("traditional"),
    ...drawerSystemHeader,
    boxSideThicknessMm:     nullablePositiveDecimal,
    boxBottomThicknessMm:   nullablePositiveDecimal,
    boxBackThicknessMm:     nullablePositiveDecimal,
    boxSubFrontThicknessMm: nullablePositiveDecimal,
    boxJoinery:             z.enum(DRAWER_BOX_JOINERIES).nullable().optional(),
    // proprietary field must be null/absent for traditional
    proprietaryFamily:      z.null().optional(),
  }),
  z.object({
    kind: z.literal("proprietary"),
    ...drawerSystemHeader,
    proprietaryFamily:      z.string().min(1).max(64),
    boxSideThicknessMm:     z.null().optional(),
    boxBottomThicknessMm:   z.null().optional(),
    boxBackThicknessMm:     z.null().optional(),
    boxSubFrontThicknessMm: z.null().optional(),
    boxJoinery:             z.null().optional(),
  }),
]);
export type DrawerSystemCreateInput = z.infer<typeof drawerSystemCreateSchema>;

/** PATCH schema — permissive partial. Kind is optional (not required).
 *  Full candidate-state validation happens in the route by merging patch
 *  onto existing row and running drawerSystemCreateSchema against the
 *  merged object. */
export const drawerSystemPatchSchema = z.object({
  kind:       z.enum(DRAWER_SYSTEM_KINDS).optional(),
  name:       z.string().min(1).max(255).optional(),
  description: z.string().max(65_535).nullable().optional(),

  boxSideThicknessMm:     nullablePositiveDecimal,
  boxBottomThicknessMm:   nullablePositiveDecimal,
  boxBackThicknessMm:     nullablePositiveDecimal,
  boxSubFrontThicknessMm: nullablePositiveDecimal,
  boxJoinery:             z.enum(DRAWER_BOX_JOINERIES).nullable().optional(),
  proprietaryFamily:      z.string().max(64).nullable().optional(),

  ...provenanceCore,
});
export type DrawerSystemPatchInput = z.infer<typeof drawerSystemPatchSchema>;

// ─── Assignment shape (Cabinet System Assignments blob) ────────────────────

const familyRuleMapPatch = z
  .object({
    base:        z.string().nullable().optional(),
    wall:        z.string().nullable().optional(),
    tall:        z.string().nullable().optional(),
    corner:      z.string().nullable().optional(),
    drawer_base: z.string().nullable().optional(),
    sink_base:   z.string().nullable().optional(),
    island:      z.string().nullable().optional(),
  })
  .strict();

/** Full shape — as returned from GET. */
export const cabinetSystemAssignmentsFullSchema = z.object({
  familyRuleIdsByCabinetType: familyRuleMapPatch.optional(),
  preferredFrontSystemId:     z.string().nullable().optional(),
  preferredDrawerSystemId:    z.string().nullable().optional(),
});
export type CabinetSystemAssignmentsFull = z.infer<typeof cabinetSystemAssignmentsFullSchema>;

/** PATCH shape — every top-level property optional (partial). Nested
 *  familyRuleIdsByCabinetType uses three-state per key. Deep-merge is
 *  a separate helper (see assignments.ts). */
export const cabinetSystemAssignmentsPatchSchema = z.object({
  familyRuleIdsByCabinetType: familyRuleMapPatch.nullable().optional(),
  preferredFrontSystemId:     z.string().nullable().optional(),
  preferredDrawerSystemId:    z.string().nullable().optional(),
});
export type CabinetSystemAssignmentsPatch = z.infer<typeof cabinetSystemAssignmentsPatchSchema>;
