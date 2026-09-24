import { z } from "zod";
import { INTERIOR_COMPONENT_VERIFICATION_STATUSES } from "./types";
import type {
  CabinetInteriorComponent,
  InteriorComponentTarget,
  StandaloneInteriorComponent,
} from "./types";

// Phase 3.0 Zod schemas — strict discriminated union.
//
// Server ALWAYS parses interior components through the union before
// persisting. UI validation is convenience only. Unknown `type`
// discriminants → 422. Zero / negative / NaN numeric fields → 422.

// ─── Primitives ─────────────────────────────────────────────────────

const positiveIntSchema = z
  .number()
  .int()
  .positive()
  .refine((v) => Number.isFinite(v), { message: "must be a finite integer" });

const positiveNumberSchema = z
  .number()
  .positive()
  .refine((v) => Number.isFinite(v), { message: "must be a finite positive number" });

const nonEmptyStringSchema = z.string().min(1).max(500);

const verificationStatusSchema = z.enum(INTERIOR_COMPONENT_VERIFICATION_STATUSES);

// ─── Target union ───────────────────────────────────────────────────
//
// Discriminated on `kind`. Only the four kinds valid in Phase 3.0
// (per §F). `opening.slotId` is intentionally excluded.

export const interiorComponentTargetSchema: z.ZodType<InteriorComponentTarget> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("cabinet") }),
    z.object({
      kind: z.literal("drawer"),
      index: z.number().int().min(0),
    }),
    z.object({
      kind: z.literal("door"),
      index: z.number().int().min(0),
    }),
    z.object({
      kind: z.literal("shelf"),
      index: z.number().int().min(0),
    }),
  ]);

// ─── Base fields shared by every component type ─────────────────────

const baseFields = {
  id: nonEmptyStringSchema,
  enabled: z.boolean(),
  label: z.string().min(1).max(255).optional(),
  notes: z.string().max(2000).optional(),
  target: interiorComponentTargetSchema.optional(),
  verificationStatus: verificationStatusSchema.optional(),
  sourceRef: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
};

// ─── Per-type schemas ───────────────────────────────────────────────
//
// STRICT mode on every variant — unknown / cross-type keys are
// REJECTED, not silently stripped. This catches classic misuse like
// `{ type: "hidden_drawer", bins: 2 }` (bins belongs to trash_pullout)
// so a stale field copied from another component type surfaces as a
// Zod error instead of hiding in the JSON blob.

const rolloutSchema = z
  .object({
    ...baseFields,
    type: z.literal("rollout"),
    quantity: positiveIntSchema.optional(),
    openSides: z.boolean().optional(),
  })
  .strict();

const trashPulloutSchema = z
  .object({
    ...baseFields,
    type: z.literal("trash_pullout"),
    bins: positiveIntSchema,
    nominalBinSizeQt: positiveNumberSchema.optional(),
    configuration: z.enum(["single", "double", "triple"]).optional(),
  })
  .strict();

const trayDividerSchema = z
  .object({
    ...baseFields,
    type: z.literal("tray_divider"),
    quantity: positiveIntSchema.optional(),
  })
  .strict();

const spiceRackSchema = z
  .object({
    ...baseFields,
    type: z.literal("spice_rack"),
    location: z.enum(["door", "interior", "pullout"]).optional(),
  })
  .strict();

const knifeOrganizerSchema = z
  .object({
    ...baseFields,
    type: z.literal("knife_organizer"),
  })
  .strict();

const utensilDividerSchema = z
  .object({
    ...baseFields,
    type: z.literal("utensil_divider"),
    removable: z.boolean().optional(),
  })
  .strict();

const drawerDividerSchema = z
  .object({
    ...baseFields,
    type: z.literal("drawer_divider"),
    orientation: z.enum(["vertical", "horizontal", "grid"]).optional(),
    removable: z.boolean().optional(),
    count: positiveIntSchema.optional(),
  })
  .strict();

const hiddenDrawerSchema = z
  .object({
    ...baseFields,
    type: z.literal("hidden_drawer"),
    location: z
      .enum(["above_drawer", "inside_cabinet", "above_trash", "custom"])
      .optional(),
  })
  .strict();

const sinkPulloutSchema = z
  .object({
    ...baseFields,
    type: z.literal("sink_pullout"),
    quantity: positiveIntSchema.optional(),
  })
  .strict();

const spongeTiltOutSchema = z
  .object({
    ...baseFields,
    type: z.literal("sponge_tilt_out"),
    quantity: positiveIntSchema.optional(),
  })
  .strict();

const customInteriorComponentSchema = z
  .object({
    ...baseFields,
    type: z.literal("custom"),
    label: nonEmptyStringSchema, // label is REQUIRED for custom
    spec: z.record(z.unknown()).optional(),
  })
  .strict();

// ─── The standalone union (Phase 3.0 contract, unchanged) ───────────

export const standaloneInteriorComponentSchema: z.ZodType<StandaloneInteriorComponent> =
  z.discriminatedUnion("type", [
    rolloutSchema,
    trashPulloutSchema,
    trayDividerSchema,
    spiceRackSchema,
    knifeOrganizerSchema,
    utensilDividerSchema,
    drawerDividerSchema,
    hiddenDrawerSchema,
    sinkPulloutSchema,
    spongeTiltOutSchema,
    customInteriorComponentSchema,
  ]);

// ─── Linked variants (Phase 3.1a — structural READ compatibility) ───
//
// DERIVED from the standalone schemas so the two can never drift:
// `.partial()` makes every field optional (a linked component stores
// only overrides; `label` becomes optional even for `custom`), then the
// identity fields + `definitionId` are re-required. `.strict()` survives
// `.partial()` / `.extend()`, so cross-type keys are still rejected.
//
// Parsing a linked component is NOT permission to write one — Phase
// 3.1a rejects any new/changed definitionId at the write-policy layer
// (server-validation.ts).

export const INTERIOR_DEFINITION_ID_MAX_LENGTH = 191;

const definitionIdSchema = z.string().min(1).max(INTERIOR_DEFINITION_ID_MAX_LENGTH);

const linkedIdentity = {
  id: baseFields.id,
  enabled: baseFields.enabled,
  definitionId: definitionIdSchema,
};

export const linkedInteriorComponentSchema = z.discriminatedUnion("type", [
  rolloutSchema.partial().extend({ ...linkedIdentity, type: z.literal("rollout") }),
  trashPulloutSchema.partial().extend({ ...linkedIdentity, type: z.literal("trash_pullout") }),
  trayDividerSchema.partial().extend({ ...linkedIdentity, type: z.literal("tray_divider") }),
  spiceRackSchema.partial().extend({ ...linkedIdentity, type: z.literal("spice_rack") }),
  knifeOrganizerSchema.partial().extend({ ...linkedIdentity, type: z.literal("knife_organizer") }),
  utensilDividerSchema.partial().extend({ ...linkedIdentity, type: z.literal("utensil_divider") }),
  drawerDividerSchema.partial().extend({ ...linkedIdentity, type: z.literal("drawer_divider") }),
  hiddenDrawerSchema.partial().extend({ ...linkedIdentity, type: z.literal("hidden_drawer") }),
  sinkPulloutSchema.partial().extend({ ...linkedIdentity, type: z.literal("sink_pullout") }),
  spongeTiltOutSchema.partial().extend({ ...linkedIdentity, type: z.literal("sponge_tilt_out") }),
  customInteriorComponentSchema.partial().extend({ ...linkedIdentity, type: z.literal("custom") }),
]);

/** True when the raw value claims to be a linked component (has an own
 *  `definitionId` key, whatever its value). Such values are parsed by
 *  the linked branch — so `definitionId: ""` is rejected there rather
 *  than slipping into the standalone branch. */
export function hasDefinitionIdKey(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "definitionId")
  );
}

// ─── The component schema (dispatches standalone vs linked) ─────────
//
// Branch selection is by presence of `definitionId`, so standalone
// components get EXACTLY the Phase 3.0 validation and error messages
// (no z.union "Invalid input" degradation).

export const cabinetInteriorComponentSchema: z.ZodType<
  CabinetInteriorComponent,
  z.ZodTypeDef,
  unknown
> = z.unknown().transform((value, ctx) => {
  const result = hasDefinitionIdKey(value)
    ? linkedInteriorComponentSchema.safeParse(value)
    : standaloneInteriorComponentSchema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) ctx.addIssue(issue);
    return z.NEVER;
  }
  return result.data as CabinetInteriorComponent;
});

/** The persisted array shape. `null` is rejected — an empty array
 *  clears components; omitting the key preserves them. Enforced with
 *  `.max(200)` as a defensive upper bound so a malformed client
 *  payload can't fill the JSON column indefinitely.
 *
 *  DUPLICATE-ID rejection: component `id` is stable identity used by
 *  edit / remove / enable-toggle / reorder / revision restore. Two
 *  components sharing an id would silently break every one of those
 *  operations. The array is rejected outright — no silent
 *  deduplication, no keep-first / keep-last, no ID regeneration. */
export const cabinetInteriorComponentsArraySchema = z
  .array(cabinetInteriorComponentSchema)
  .max(200)
  .superRefine((arr, ctx) => {
    const seen = new Map<string, number>();
    for (let i = 0; i < arr.length; i++) {
      const id = arr[i]!.id;
      const previousIndex = seen.get(id);
      if (previousIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate component id '${id}' at indexes ${previousIndex} and ${i}`,
          path: [i, "id"],
        });
      } else {
        seen.set(id, i);
      }
    }
  });

export type CabinetInteriorComponentsArray = z.infer<
  typeof cabinetInteriorComponentsArraySchema
>;
