// Same-org ownership guards for Phase 2 system rows. Mirrors Phase 1's
// `assertProfileBelongsToOrg` — uniform "not_found" for both "does not
// exist" and "belongs to another org" so cross-tenant existence isn't
// leaked.

export interface SystemTenancyCheckOk {
  ok: true;
  row: { id: string; orgId: string };
}
export interface SystemTenancyCheckErr {
  ok: false;
  reason: "not_found";
}
export type SystemTenancyCheckResult = SystemTenancyCheckOk | SystemTenancyCheckErr;

export function assertSystemBelongsToOrg(
  row: { id: string; orgId: string } | null | undefined,
  ctxOrgId: string,
): SystemTenancyCheckResult {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.orgId !== ctxOrgId) return { ok: false, reason: "not_found" };
  return { ok: true, row };
}
