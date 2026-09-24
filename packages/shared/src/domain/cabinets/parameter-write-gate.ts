// Canonical write gate for EXTERNALLY supplied Cabinet.parameters.
//
// Every HTTP path that accepts a client-authored `parameters` bag
// (Cabinet POST, Cabinet PATCH) runs this ONE function, so the create
// path can never drift behind the update path again (Phase 3.1a closed
// a gap where POST persisted `z.record(z.any())` unvalidated).
//
// Steps, in order:
//   1. Structural + interior write policy —
//      `validateIncomingCabinetParameters` (422 / 409).
//   2. Tenancy for every non-empty profile ref (constructionProfileId /
//      materialProfileId / hardwareProfileId) → uniform 404.
//   3. Tenancy for every non-empty system ref (familyRuleId /
//      frontSystemId / drawerSystemId) → uniform 404; familyRule
//      cabinetType must equal the cabinet's type → 422.
//
// DB access is injected (`lookup`) so the whole gate stays unit-testable
// in the shared Vitest harness. Deletions (`null`) skip lookups by design.
//
// NOT for internal copies of already-stored data (revision restore):
// historical payloads are restored verbatim and must never be re-validated
// against a newer schema.

import {
  validateIncomingCabinetParameters,
  type IncomingParametersValidationOptions,
} from "../interiorComponents/server-validation";
import { assertProfileBelongsToOrg } from "../profiles/tenancy";
import { assertSystemBelongsToOrg } from "../systems/tenancy";
import { CABINET_SYSTEM_REF_KEYS } from "../systems/types";
import { CABINET_PROFILE_REF_KEYS } from "./parameters-patch";

type OrgRow = { id: string; orgId: string };

export interface CabinetParameterRefLookup {
  constructionProfile(id: string, orgId: string): Promise<OrgRow | null>;
  materialProfile(id: string, orgId: string): Promise<OrgRow | null>;
  hardwareProfile(id: string, orgId: string): Promise<OrgRow | null>;
  familyRule(id: string, orgId: string): Promise<(OrgRow & { cabinetType: string }) | null>;
  frontSystem(id: string, orgId: string): Promise<OrgRow | null>;
  drawerSystem(id: string, orgId: string): Promise<OrgRow | null>;
}

export type CabinetParametersWriteResult =
  | { ok: true; parameters: Record<string, unknown> | undefined }
  | { ok: false; status: 404 | 409 | 422; code?: "VALIDATION_ERROR"; error: string };

export async function gateCabinetParametersWrite(input: {
  orgId: string;
  /** The cabinet's type AFTER this write (create: incoming type;
   *  update: the stored type — cabinet type is not patchable). */
  cabinetType: string;
  parameters: Record<string, unknown> | null | undefined;
  /** Update only — see IncomingParametersValidationOptions. */
  existingParameters?: IncomingParametersValidationOptions["existingParameters"];
  lookup: CabinetParameterRefLookup;
}): Promise<CabinetParametersWriteResult> {
  // 1. Structural + interior write policy.
  const validated = validateIncomingCabinetParameters(input.parameters, {
    existingParameters: input.existingParameters,
  });
  if (!validated.ok) {
    return { ok: false, status: validated.status, code: "VALIDATION_ERROR", error: validated.error };
  }
  const params = validated.parameters;
  if (!params) return { ok: true, parameters: undefined };

  // 2. Profile refs — uniform 404, no cross-org metadata leak.
  for (const key of CABINET_PROFILE_REF_KEYS) {
    const value = params[key];
    if (typeof value !== "string" || value.length === 0) continue;
    const row =
      key === "constructionProfileId"
        ? await input.lookup.constructionProfile(value, input.orgId)
        : key === "materialProfileId"
          ? await input.lookup.materialProfile(value, input.orgId)
          : await input.lookup.hardwareProfile(value, input.orgId);
    if (!assertProfileBelongsToOrg(row, input.orgId).ok) {
      return { ok: false, status: 404, error: "Profile not found" };
    }
  }

  // 3. System refs — same uniform 404 posture.
  for (const key of CABINET_SYSTEM_REF_KEYS) {
    const value = params[key];
    if (typeof value !== "string" || value.length === 0) continue;

    if (key === "familyRuleId") {
      const row = await input.lookup.familyRule(value, input.orgId);
      if (!assertSystemBelongsToOrg(row, input.orgId).ok) {
        return { ok: false, status: 404, error: "Not found" };
      }
      // Phase 2.1 semantic guard: familyRule.cabinetType must match the
      // cabinet's own type.
      if (row && row.cabinetType !== input.cabinetType) {
        return {
          ok: false,
          status: 422,
          code: "VALIDATION_ERROR",
          error: `Family rule '${value}' targets cabinetType='${row.cabinetType}' but this cabinet is type='${input.cabinetType}'.`,
        };
      }
      continue;
    }

    const row =
      key === "frontSystemId"
        ? await input.lookup.frontSystem(value, input.orgId)
        : await input.lookup.drawerSystem(value, input.orgId);
    if (!assertSystemBelongsToOrg(row, input.orgId).ok) {
      return { ok: false, status: 404, error: "Not found" };
    }
  }

  return { ok: true, parameters: params };
}
