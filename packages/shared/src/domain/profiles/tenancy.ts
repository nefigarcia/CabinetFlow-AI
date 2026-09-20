// Same-org ownership guard for profile assignment. The FK constraint
// only guarantees a profile EXISTS — not that it belongs to the caller's
// org. Every API mutation that writes a profile ID (org defaults,
// project overrides, room overrides, Cabinet.parameters profile refs)
// MUST call `assertProfileBelongsToOrg` before persistence.
//
// Rejection reason is intentionally uniform ("not_found") for both
// "does not exist" and "belongs to another org" — no metadata leak
// about the existence of other orgs' profiles.

// ProfileKind is re-exported from ./types via the public index — do
// NOT redeclare here or the namespace re-export will conflict.

export interface TenancyCheckOk {
  ok: true;
  profile: { id: string; orgId: string };
}
export interface TenancyCheckErr {
  ok: false;
  reason: "not_found";
}
export type TenancyCheckResult = TenancyCheckOk | TenancyCheckErr;

export function assertProfileBelongsToOrg(
  profile: { id: string; orgId: string } | null | undefined,
  ctxOrgId: string,
): TenancyCheckResult {
  if (!profile) return { ok: false, reason: "not_found" };
  if (profile.orgId !== ctxOrgId) return { ok: false, reason: "not_found" };
  return { ok: true, profile };
}
