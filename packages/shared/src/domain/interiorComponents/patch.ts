// Phase 3.0 patch helpers — atomic replacement of the
// `Cabinet.parameters.interiorComponents` array.
//
// Contract:
//   · `null` → REJECTED at Zod level. Not accepted here either.
//   · `[]`   → clears components.
//   · omitted from PATCH → array preserved.
//   · array value → REPLACES the whole array atomically.
//
// All other Cabinet.parameters keys MUST be preserved verbatim. That is
// already guaranteed by the existing `applyCabinetParametersPatch` for
// non-DELETABLE keys — this module just gives typed accessors on top
// so callers don't stringify JSON blobs by hand.

import { cabinetInteriorComponentsArraySchema } from "./schemas";
import type { CabinetInteriorComponent } from "./types";

/** The reserved key inside Cabinet.parameters where interior components
 *  live. Kept as a constant to avoid stringly-typed drift. */
export const INTERIOR_COMPONENTS_PARAM_KEY = "interiorComponents" as const;

/** Safe read of the interior-components array from a parameters bag.
 *  Any shape that doesn't parse as an array of valid components
 *  returns `[]` — matches the "unknown ≠ zero" rule but keeps the
 *  Inspector from crashing on legacy / malformed rows. */
export function readInteriorComponents(
  parameters: Record<string, unknown> | null | undefined,
): CabinetInteriorComponent[] {
  if (!parameters) return [];
  const raw = parameters[INTERIOR_COMPONENTS_PARAM_KEY];
  if (!Array.isArray(raw)) return [];
  const parsed = cabinetInteriorComponentsArraySchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}

/** Produces the FULL PATCH body for Cabinet PATCH — replaces the
 *  interior-components array atomically. Other parameter keys are
 *  passed straight through by the server-side
 *  `applyCabinetParametersPatch` helper (unknown keys → preserved). */
export function buildInteriorComponentsPatch(
  next: readonly CabinetInteriorComponent[],
): { parameters: { interiorComponents: CabinetInteriorComponent[] } } {
  return {
    parameters: {
      [INTERIOR_COMPONENTS_PARAM_KEY]: [...next],
    },
  };
}

// ─── Local array operations (client-side only; PATCH still atomic) ──
//
// Callers (Inspector) compute the next full array locally with these
// helpers, then PATCH the whole thing. Server never partial-writes.

export function addInteriorComponent(
  current: readonly CabinetInteriorComponent[],
  component: CabinetInteriorComponent,
): CabinetInteriorComponent[] {
  return [...current, component];
}

/** Complete-replacement update (§E rule). The caller passes the full
 *  candidate component; we locate by id and swap. Rejects mismatched
 *  IDs — replacement.id must equal componentId. */
export function updateInteriorComponent(
  current: readonly CabinetInteriorComponent[],
  componentId: string,
  replacement: CabinetInteriorComponent,
): CabinetInteriorComponent[] {
  if (replacement.id !== componentId) {
    throw new Error(
      `replacement.id (${replacement.id}) must equal componentId (${componentId})`,
    );
  }
  let found = false;
  const next = current.map((c) => {
    if (c.id === componentId) {
      found = true;
      return replacement;
    }
    return c;
  });
  if (!found) {
    throw new Error(`no interior component with id=${componentId}`);
  }
  return next;
}

export function removeInteriorComponent(
  current: readonly CabinetInteriorComponent[],
  componentId: string,
): CabinetInteriorComponent[] {
  return current.filter((c) => c.id !== componentId);
}

export function setInteriorComponentEnabled(
  current: readonly CabinetInteriorComponent[],
  componentId: string,
  enabled: boolean,
): CabinetInteriorComponent[] {
  return current.map((c) => (c.id === componentId ? { ...c, enabled } : c));
}

/** Reorders by an explicit id sequence. Every id in `orderedIds` must
 *  match an existing component; every existing id must appear exactly
 *  once in `orderedIds`. Mismatches throw — the caller is expected to
 *  have built the sequence from the current list. */
export function reorderInteriorComponents(
  current: readonly CabinetInteriorComponent[],
  orderedIds: readonly string[],
): CabinetInteriorComponent[] {
  if (orderedIds.length !== current.length) {
    throw new Error(
      `orderedIds length (${orderedIds.length}) must equal current length (${current.length})`,
    );
  }
  const byId = new Map(current.map((c) => [c.id, c] as const));
  const next: CabinetInteriorComponent[] = [];
  for (const id of orderedIds) {
    const c = byId.get(id);
    if (!c) throw new Error(`unknown id in orderedIds: ${id}`);
    next.push(c);
  }
  return next;
}
