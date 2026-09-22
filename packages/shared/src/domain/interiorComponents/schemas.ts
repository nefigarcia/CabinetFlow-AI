import { z } from "zod";
import { INTERIOR_COMPONENT_VERIFICATION_STATUSES } from "./types";
import type { CabinetInteriorComponent, InteriorComponentTarget } from "./types";

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

// ─── The union ──────────────────────────────────────────────────────

export const cabinetInteriorComponentSchema: z.ZodType<CabinetInteriorComponent> =
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
