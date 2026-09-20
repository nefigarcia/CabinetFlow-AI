// Phase 2 candidate-state PATCH validation for DrawerSystem.
//
// CREATE uses the discriminated-union `drawerSystemCreateSchema` — it
// enforces that traditional rows carry only traditional fields and
// proprietary rows carry only proprietary fields.
//
// PATCH uses the permissive `drawerSystemPatchSchema` (any subset of
// keys). Route callers must:
//   1. Parse against `drawerSystemPatchSchema`.
//   2. Load existing row.
//   3. Build candidate final state (merge patch onto existing).
//   4. Validate candidate against `drawerSystemCreateSchema`.
//   5. Persist only the explicit patch keys via `buildPartialPrismaUpdate`.
//
// The helper below is step 3 — a pure merge that produces a candidate
// object suitable for step-4 validation.

import type { DrawerSystemFields } from "./types";

export interface DrawerSystemCandidateInput {
  existing: DrawerSystemFields & { name: string; description: string | null };
  patch: Record<string, unknown>;
}

/** Merges a PATCH payload onto an existing DrawerSystem row and returns
 *  the candidate final state. Three-state per key:
 *    undefined → keep existing
 *    null      → clear (for nullable fields)
 *    value     → set
 *  The returned object is suitable for feeding into
 *  `drawerSystemCreateSchema.safeParse`. */
export function buildDrawerSystemCandidate(
  input: DrawerSystemCandidateInput,
): Record<string, unknown> {
  const keys = [
    "name",
    "description",
    "kind",
    "boxSideThicknessMm",
    "boxBottomThicknessMm",
    "boxBackThicknessMm",
    "boxSubFrontThicknessMm",
    "boxJoinery",
    "proprietaryFamily",
  ] as const;
  const out: Record<string, unknown> = {
    kind: input.existing.kind,
    name: input.existing.name,
    description: input.existing.description,
    boxSideThicknessMm:     input.existing.boxSideThicknessMm,
    boxBottomThicknessMm:   input.existing.boxBottomThicknessMm,
    boxBackThicknessMm:     input.existing.boxBackThicknessMm,
    boxSubFrontThicknessMm: input.existing.boxSubFrontThicknessMm,
    boxJoinery:             input.existing.boxJoinery,
    proprietaryFamily:      input.existing.proprietaryFamily,
  };
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(input.patch, k)) continue;
    const v = input.patch[k];
    if (v === undefined) continue;
    out[k] = v; // null OR value — both are legal per drawerSystemPatchSchema
  }

  // Kind-transition strip: when the candidate is `traditional`, any
  // proprietaryFamily must be null. When candidate is `proprietary`,
  // all box* + boxJoinery must be null. Callers running the CREATE
  // schema on this object will fail-fast if the patch left stale values.
  return out;
}
