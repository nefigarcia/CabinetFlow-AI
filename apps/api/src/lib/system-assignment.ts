// Shared same-org tenancy check for Phase 2 system-assignment writes
// (Org / Project / Room). Uniform 404 on unknown or cross-org IDs.

import { prisma } from "@/lib/prisma";
import type { CabinetSystemAssignmentsPatch } from "@woodcraft/shared";
import { assertSystemBelongsToOrg } from "@woodcraft/shared";

/** Verifies every non-null ID in an assignments patch belongs to the
 *  given org. Returns `null` on success, `"not_found"` on any failure. */
export async function verifySystemAssignmentTenancy(
  patch: CabinetSystemAssignmentsPatch | null | undefined,
  ctxOrgId: string,
): Promise<null | "not_found"> {
  if (!patch) return null;

  const familyIds = patch.familyRuleIdsByCabinetType
    ? Object.values(patch.familyRuleIdsByCabinetType).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      )
    : [];
  for (const id of familyIds) {
    const row = await prisma.cabinetFamilyRule.findFirst({
      where: { id, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = assertSystemBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }

  if (typeof patch.preferredFrontSystemId === "string" && patch.preferredFrontSystemId.length > 0) {
    const row = await prisma.frontSystem.findFirst({
      where: { id: patch.preferredFrontSystemId, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = assertSystemBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }

  if (typeof patch.preferredDrawerSystemId === "string" && patch.preferredDrawerSystemId.length > 0) {
    const row = await prisma.drawerSystem.findFirst({
      where: { id: patch.preferredDrawerSystemId, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = assertSystemBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }

  return null;
}
