// Phase 3.0 AI-Copilot operation schema — CONTRACT ONLY.
//
// AI wiring is deliberately out of scope for Phase 3.0. This module
// defines the deterministic operation shape a future Phase 3.x will
// dispatch through the SAME server-side Zod validation + Cabinet PATCH
// authorization used by the Inspector. AI never mutates
// `Cabinet.parameters.interiorComponents` directly.
//
// Server dispatch flow (documented for later implementation):
//   1. Parse operation with this Zod schema.
//   2. Load the current cabinet's `parameters.interiorComponents` array.
//   3. Compute the next array locally (add / update-replace / remove /
//      reorder) using the shared patch helpers.
//   4. Validate the ENTIRE resulting array through
//      `cabinetInteriorComponentsArraySchema`.
//   5. PATCH via the canonical Cabinet parameters helper — same
//      `canAssignCabinetSystems` role guard as the UI, same atomic
//      replacement semantics.
//
// §E rule locked in: `update_interior_component` carries a COMPLETE
// replacement component (never a `Partial<CabinetInteriorComponent>`).
// A partial patch over a discriminated union is not type-safe.

import { z } from "zod";
import { cabinetInteriorComponentSchema } from "./schemas";

const addOpSchema = z.object({
  op: z.literal("add_interior_component"),
  cabinetId: z.string().min(1),
  component: cabinetInteriorComponentSchema,
});

// NOTE: Zod's `discriminatedUnion` does not accept ZodEffects (i.e. no
// `.superRefine()` on the option itself). The `component.id ===
// componentId` invariant is enforced by `assertUpdateOperationInvariant`
// below — dispatchers MUST call it after schema parse. The shared
// `updateInteriorComponent` patch helper also checks it, so a bad AI
// op is rejected before it can reach the DB even if a dispatcher
// forgets the explicit assert.
const updateOpSchema = z.object({
  op: z.literal("update_interior_component"),
  cabinetId: z.string().min(1),
  componentId: z.string().min(1),
  component: cabinetInteriorComponentSchema,
});

const removeOpSchema = z.object({
  op: z.literal("remove_interior_component"),
  cabinetId: z.string().min(1),
  componentId: z.string().min(1),
});

const reorderOpSchema = z.object({
  op: z.literal("reorder_interior_components"),
  cabinetId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export const interiorComponentOperationSchema = z.discriminatedUnion("op", [
  addOpSchema,
  updateOpSchema,
  removeOpSchema,
  reorderOpSchema,
]);

export type InteriorComponentOperation = z.infer<
  typeof interiorComponentOperationSchema
>;

/** Explicit invariant check for the update op — `component.id` MUST
 *  equal `componentId`. Throws on mismatch so dispatchers can rely on
 *  the shape at their call sites. Also enforced by
 *  `updateInteriorComponent` on the patch helper. */
export function assertUpdateOperationInvariant(
  op: InteriorComponentOperation,
): void {
  if (op.op !== "update_interior_component") return;
  if (op.component.id !== op.componentId) {
    throw new Error(
      `update_interior_component: component.id (${op.component.id}) must equal componentId (${op.componentId})`,
    );
  }
}
