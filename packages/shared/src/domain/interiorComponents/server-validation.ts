// Phase 3.0 server-side validation for incoming Cabinet.parameters
// PATCHes.
//
// PROBLEM this closes:
//   The Cabinet PATCH route's `updateCabinetSchema` accepts
//   `parameters: z.record(z.any()).optional()` — any object shape is
//   accepted. Without this helper, a forged client could POST:
//     { parameters: { interiorComponents: [{ type: "totally_fake" }] } }
//   or:
//     { parameters: { interiorComponents: null } }
//   and the value would land in the JSON column unvalidated.
//
// CONTRACT:
//   · Input: raw incoming `parameters` object (or null/undefined for
//     "not in this patch").
//   · If `parameters` does NOT contain `interiorComponents`, the
//     input is returned unchanged (`{ ok: true, parameters }`).
//   · If it DOES contain `interiorComponents`, that value is
//     Zod-parsed through `cabinetInteriorComponentsArraySchema`.
//     Invalid → `{ ok: false, error: string }`.
//     Valid  → returned with the canonical parsed array in place of
//              the raw one (`{ ok: true, parameters: {...parameters,
//              interiorComponents: parsedArray} }`).
//
// This helper is deliberately shared (not API-only) so it can be
// exercised by the existing shared Vitest harness without introducing
// an API test framework. The Cabinet PATCH route calls it AFTER the
// per-field Zod parse of updateCabinetSchema and BEFORE
// applyCabinetParametersPatch.

import { cabinetInteriorComponentsArraySchema } from "./schemas";
import type { CabinetInteriorComponent } from "./types";
import { INTERIOR_COMPONENTS_PARAM_KEY } from "./patch";

export type IncomingParametersValidationResult =
  | {
      ok: true;
      /** The incoming parameters object with `interiorComponents`
       *  replaced by the canonical parsed array (if present). All
       *  other keys pass through unchanged. */
      parameters: Record<string, unknown> | undefined;
    }
  | {
      ok: false;
      /** Human-readable message safe for a 422 body — no PII, no
       *  internal type names. */
      error: string;
    };

/** The Cabinet PATCH route calls this on the raw incoming `parameters`
 *  before merging. Returns a sanitized parameters object on success,
 *  or a validation-error message the route can pass to `apiError`. */
export function validateIncomingCabinetParameters(
  parameters: Record<string, unknown> | null | undefined,
): IncomingParametersValidationResult {
  if (parameters === undefined || parameters === null) {
    return { ok: true, parameters: undefined };
  }
  if (typeof parameters !== "object" || Array.isArray(parameters)) {
    return { ok: false, error: "parameters: must be a JSON object" };
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
      error: `${INTERIOR_COMPONENTS_PARAM_KEY}: ${summary}`,
    };
  }

  // Return the sanitized object — canonical parsed array in place of
  // whatever the client sent (shape may differ only where zod stripped
  // undefined optionals; in strict mode nothing is stripped).
  const parsedArr: CabinetInteriorComponent[] = parsed.data;
  return {
    ok: true,
    parameters: {
      ...parameters,
      [INTERIOR_COMPONENTS_PARAM_KEY]: parsedArr,
    },
  };
}
