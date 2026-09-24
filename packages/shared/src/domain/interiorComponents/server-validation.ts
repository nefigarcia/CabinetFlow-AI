// Phase 3.0 / 3.1a server-side validation for incoming Cabinet.parameters
// writes (Cabinet PATCH and Cabinet POST).
//
// PROBLEM this closes:
//   The Cabinet routes' `parameters` field is `z.record(z.any())` — any
//   object shape is accepted. Without this helper, a forged client could
//   POST:
//     { parameters: { interiorComponents: [{ type: "totally_fake" }] } }
//   or:
//     { parameters: { interiorComponents: null } }
//   and the value would land in the JSON column unvalidated.
//
// CONTRACT:
//   · Input: raw incoming `parameters` object (or null/undefined for
//     "not in this patch"), plus — for updates — the cabinet's CURRENT
//     stored parameters.
//   · If `parameters` does NOT contain `interiorComponents`, the
//     input is returned unchanged (`{ ok: true, parameters }`).
//   · If it DOES contain `interiorComponents`:
//       1. STRUCTURAL: Zod-parsed through
//          `cabinetInteriorComponentsArraySchema` → 422 on failure.
//       2. WRITE POLICY (Phase 3.1a): see
//          `enforceInteriorComponentsWritePolicy` below → 409 / 422.
//     Valid → returned with the canonical array in place of the raw one.
//
// This helper is deliberately shared (not API-only) so it can be
// exercised by the existing shared Vitest harness without introducing
// an API test framework.

import { cabinetInteriorComponentsArraySchema } from "./schemas";
import type { CabinetInteriorComponent } from "./types";
import {
  INTERIOR_COMPONENTS_PARAM_KEY,
  isLinkedInteriorComponent,
  readInteriorComponentsSafe,
} from "./patch";

export type IncomingParametersValidationResult =
  | {
      ok: true;
      /** The incoming parameters object with `interiorComponents`
       *  replaced by the canonical array (if present). All other keys
       *  pass through unchanged. */
      parameters: Record<string, unknown> | undefined;
    }
  | {
      ok: false;
      /** 422 = invalid payload; 409 = the stored value cannot be safely
       *  overwritten by this version. */
      status: 409 | 422;
      /** Human-readable message safe for an error body — no PII, no
       *  internal type names. */
      error: string;
    };

export interface IncomingParametersValidationOptions {
  /** The cabinet's CURRENT stored `parameters` (updates only). Omit for
   *  creates. When omitted, the write policy behaves as if nothing is
   *  stored — i.e. ANY definitionId is rejected (fail-closed). */
  existingParameters?: Record<string, unknown> | null;
}

/** Canonical gate for incoming `Cabinet.parameters` on every external
 *  write path. Returns sanitized parameters on success, or an error
 *  the route can pass to `apiError(error, status, ...)`. */
export function validateIncomingCabinetParameters(
  parameters: Record<string, unknown> | null | undefined,
  options: IncomingParametersValidationOptions = {},
): IncomingParametersValidationResult {
  if (parameters === undefined || parameters === null) {
    return { ok: true, parameters: undefined };
  }
  if (typeof parameters !== "object" || Array.isArray(parameters)) {
    return { ok: false, status: 422, error: "parameters: must be a JSON object" };
  }

  // No interiorComponents key → nothing for us to validate; pass through.
  if (!(INTERIOR_COMPONENTS_PARAM_KEY in parameters)) {
    return { ok: true, parameters };
  }

  const raw = parameters[INTERIOR_COMPONENTS_PARAM_KEY];

  // Explicit null is rejected — an empty array clears components; a
  // missing key preserves them; null is never a legal shape.
  if (raw === null) {
    return {
      ok: false,
      status: 422,
      error: `${INTERIOR_COMPONENTS_PARAM_KEY}: null is not allowed. Use [] to clear or omit the key to preserve.`,
    };
  }

  const parsed = cabinetInteriorComponentsArraySchema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `${i.path.join(".") || INTERIOR_COMPONENTS_PARAM_KEY}: ${i.message}`)
      .slice(0, 8) // cap the message length; the full error is available in server logs
      .join("; ");
    return {
      ok: false,
      status: 422,
      error: `${INTERIOR_COMPONENTS_PARAM_KEY}: ${summary}`,
    };
  }

  const policy = enforceInteriorComponentsWritePolicy({
    incoming: parsed.data,
    existingParameters: options.existingParameters ?? null,
  });
  if (!policy.ok) return policy;

  return {
    ok: true,
    parameters: {
      ...parameters,
      [INTERIOR_COMPONENTS_PARAM_KEY]: policy.components,
    },
  };
}

// ─── Phase 3.1a write policy ────────────────────────────────────────
//
// Phase 3.1a can READ linked components (definitionId) — so it is a
// safe rollback target from 3.1b — but there is no AccessoryDefinition
// table yet, so it must never let a reference be CREATED or CHANGED.
//
// Rules, applied to a structurally-valid incoming array:
//
//   A. Stored value unreadable by this version → 409. Never overwrite
//      data this code cannot understand (twin of the Inspector guard).
//   B. Every incoming linked component must be IDENTICAL (same id and
//      deep-equal content) to a linked component already stored on this
//      cabinet → otherwise 422. Covers: new definitionId, changed
//      definitionId, standalone→linked, and any edit to a linked
//      component (overrides, enabled, target, …).
//   C. Every stored linked component must still be present AS A LINKED
//      component → otherwise 422. 3.1a may not remove / strip / flatten
//      a linked component (same id re-sent without definitionId counts).
//
// Unchanged linked components are written back from the STORED raw
// element (verbatim), not the Zod re-serialization.
//
// Creates pass no stored parameters, so any definitionId is rejected.

export type InteriorWritePolicyResult =
  | { ok: true; components: unknown[] }
  | { ok: false; status: 409 | 422; error: string };

export function enforceInteriorComponentsWritePolicy(input: {
  incoming: readonly CabinetInteriorComponent[];
  existingParameters: Record<string, unknown> | null | undefined;
}): InteriorWritePolicyResult {
  const stored = readInteriorComponentsSafe(input.existingParameters);

  // A. Refuse to overwrite a stored value this version cannot read.
  if (stored.status === "unreadable") {
    return {
      ok: false,
      status: 409,
      error:
        `${INTERIOR_COMPONENTS_PARAM_KEY}: the stored interior components cannot be safely read by this version; ` +
        `refusing to overwrite them.`,
    };
  }

  const storedRaw = input.existingParameters?.[INTERIOR_COMPONENTS_PARAM_KEY];
  const storedRawArr: unknown[] = Array.isArray(storedRaw) ? storedRaw : [];
  const storedLinkedById = new Map<string, { parsed: CabinetInteriorComponent; raw: unknown }>();
  stored.components.forEach((c, i) => {
    if (isLinkedInteriorComponent(c)) storedLinkedById.set(c.id, { parsed: c, raw: storedRawArr[i] });
  });

  // B. No new / changed / edited linked components.
  const out: unknown[] = [];
  for (const c of input.incoming) {
    if (!isLinkedInteriorComponent(c)) {
      out.push(c);
      continue;
    }
    const prev = storedLinkedById.get(c.id);
    if (!prev || stableStringify(prev.parsed) !== stableStringify(c)) {
      return {
        ok: false,
        status: 422,
        error:
          `${INTERIOR_COMPONENTS_PARAM_KEY}: component '${c.id}': shop-standard links (definitionId) ` +
          `cannot be created or modified by this version.`,
      };
    }
    out.push(prev.raw);
  }

  // C. No removal of stored linked components — and no flattening: the
  //    same id re-sent as a standalone component (definitionId stripped)
  //    counts as removal of the link. (B already guarantees every linked
  //    incoming component is identical to its stored counterpart.)
  const incomingLinkedIds = new Set(
    input.incoming.filter(isLinkedInteriorComponent).map((c) => c.id),
  );
  for (const id of storedLinkedById.keys()) {
    if (!incomingLinkedIds.has(id)) {
      return {
        ok: false,
        status: 422,
        error:
          `${INTERIOR_COMPONENTS_PARAM_KEY}: component '${id}' is linked to a shop standard and ` +
          `cannot be removed, unlinked, or flattened by this version.`,
      };
    }
  }

  return { ok: true, components: out };
}

/** Key-order-independent JSON serialization for deep equality of
 *  JSON-safe values (components come out of Zod / a JSON column). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
