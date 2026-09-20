import { z } from "zod";
import {
  CONSTRUCTION_FIELDS,
  FIELD_VERIFICATION_STATUSES,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  VERIFICATION_STATUSES,
  type FieldProvenance,
  type FieldProvenanceMap,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Reusable primitives
//
// Every nullable Prisma column uses `.nullable().optional()` so the API's
// three-state PATCH semantics work correctly:
//   undefined → key absent from patch → column untouched
//   null      → clear the column      → inheritance resolver falls through
//   value     → override the column
// ═══════════════════════════════════════════════════════════════════════════

const nullableString = (max: number) => z.string().max(max).nullable().optional();

const nullablePositiveDecimal = z
  .number()
  .refine((v) => Number.isFinite(v), { message: "must be finite" })
  .refine((v) => v > 0, { message: "must be positive" })
  .nullable()
  .optional();

const nullableBoolean = z.boolean().nullable().optional();

// ═══════════════════════════════════════════════════════════════════════════
// Field provenance
// ═══════════════════════════════════════════════════════════════════════════

export const fieldVerificationStatusSchema = z.enum(FIELD_VERIFICATION_STATUSES);

export const fieldProvenanceSchema: z.ZodType<FieldProvenance> = z.object({
  status:    fieldVerificationStatusSchema,
  sourceRef: z.string().max(200).nullable().optional(),
});

/** Loose API-boundary schema: any string key, valid FieldProvenance value.
 *  Unknown keys are preserved through PATCH but the resolver ignores them
 *  because it iterates the canonical field list only. */
export const fieldProvenanceMapSchema: z.ZodType<FieldProvenanceMap> =
  z.record(fieldProvenanceSchema);

/** Strict variant — rejects keys outside the canonical list. Used for
 *  seed-shape tests + admin fixtures, never at the API boundary. */
export function makeStrictFieldProvenanceMapSchema(
  fields: readonly string[],
): z.ZodType<FieldProvenanceMap> {
  const allowed = new Set(fields);
  return fieldProvenanceMapSchema.superRefine((map, ctx) => {
    for (const key of Object.keys(map)) {
      if (!allowed.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown field '${key}' for this profile kind`,
          path: [key],
        });
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Verification gaps + status
// ═══════════════════════════════════════════════════════════════════════════

export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);

export const verificationGapsSchema = z
  .array(z.string().min(1).max(80))
  .max(200)
  .transform((arr) => Array.from(new Set(arr)))
  .nullable()
  .optional();

// ═══════════════════════════════════════════════════════════════════════════
// Metadata (loose JSON blob — deferredCapabilities inside)
// ═══════════════════════════════════════════════════════════════════════════

export const nullableMetadataSchema = z.record(z.unknown()).nullable().optional();

// ═══════════════════════════════════════════════════════════════════════════
// Profile write schemas (create + patch share shape; use .partial() for patch)
// ═══════════════════════════════════════════════════════════════════════════

export const constructionProfileWriteSchema = z.object({
  name:                        z.string().min(1).max(120),
  description:                 z.string().max(65_535).nullable().optional(),

  constructionMethod:          z.enum(["face_frame", "frameless"]).nullable().optional(),
  frontOverlayMode:            z.enum(["inset", "partial_overlay", "full_overlay"]).nullable().optional(),
  carcassThicknessMm:          nullablePositiveDecimal,
  drawerBoxThicknessMm:        nullablePositiveDecimal,
  drawerBoxJoinery:            nullableString(60),
  backThicknessMm:             nullablePositiveDecimal,
  adjustableShelfThicknessMm:  nullablePositiveDecimal,
  nailerThicknessMm:           nullablePositiveDecimal,

  verificationStatus:          verificationStatusSchema.optional(),
  verificationGaps:            verificationGapsSchema,
  sourceRef:                   nullableString(200),
  fieldProvenance:             fieldProvenanceMapSchema.nullable().optional(),
  metadata:                    nullableMetadataSchema,
});
export type ConstructionProfileWriteInput = z.infer<typeof constructionProfileWriteSchema>;

export const cabinetMaterialProfileWriteSchema = z.object({
  name:                          z.string().min(1).max(120),
  description:                   z.string().max(65_535).nullable().optional(),

  carcassMaterialSpec:           nullableString(200),
  drawerBoxMaterialSpec:         nullableString(200),
  faceFrameMaterialSpec:         nullableString(200),
  doorMaterialSpec:              nullableString(200),
  shelfMaterialSpec:             nullableString(200),
  backMaterialSpec:              nullableString(200),
  adjustableShelfMaterialSpec:   nullableString(200),
  nailerMaterialSpec:            nullableString(200),

  verificationStatus:            verificationStatusSchema.optional(),
  verificationGaps:              verificationGapsSchema,
  sourceRef:                     nullableString(200),
  fieldProvenance:               fieldProvenanceMapSchema.nullable().optional(),
  metadata:                      nullableMetadataSchema,
});
export type CabinetMaterialProfileWriteInput = z.infer<typeof cabinetMaterialProfileWriteSchema>;

export const hardwareProfileWriteSchema = z.object({
  name:                          z.string().min(1).max(120),
  description:                   z.string().max(65_535).nullable().optional(),

  hingeManufacturer:             nullableString(60),
  hingeSoftClose:                nullableBoolean,   // NULL = unknown, distinct from verified false
  hingeSystem:                   nullableString(120),
  drawerSlideManufacturer:       nullableString(60),
  drawerSlideSoftClose:          nullableBoolean,
  drawerSlideSystem:             nullableString(120),

  verificationStatus:            verificationStatusSchema.optional(),
  verificationGaps:              verificationGapsSchema,
  sourceRef:                     nullableString(200),
  fieldProvenance:               fieldProvenanceMapSchema.nullable().optional(),
  metadata:                      nullableMetadataSchema,
});
export type HardwareProfileWriteInput = z.infer<typeof hardwareProfileWriteSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Assignment schemas (Org defaults, Project/Room overrides)
// ═══════════════════════════════════════════════════════════════════════════

export const assignProfilesToOrgSchema = z.object({
  defaultConstructionProfileId: z.string().min(1).nullable().optional(),
  defaultMaterialProfileId:     z.string().min(1).nullable().optional(),
  defaultHardwareProfileId:     z.string().min(1).nullable().optional(),
});
export type AssignProfilesToOrgInput = z.infer<typeof assignProfilesToOrgSchema>;

export const assignProfilesToProjectSchema = z.object({
  constructionProfileId: z.string().min(1).nullable().optional(),
  materialProfileId:     z.string().min(1).nullable().optional(),
  hardwareProfileId:     z.string().min(1).nullable().optional(),
});
export type AssignProfilesToProjectInput = z.infer<typeof assignProfilesToProjectSchema>;

export const assignProfilesToRoomSchema = assignProfilesToProjectSchema;
export type AssignProfilesToRoomInput = AssignProfilesToProjectInput;

// Re-export canonical field lists for API-side strict provenance validation.
export {
  CONSTRUCTION_FIELDS,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
};
