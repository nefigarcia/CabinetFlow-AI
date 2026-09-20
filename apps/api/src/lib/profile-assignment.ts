// Shared same-org tenancy check for profile-ID assignments. Used by the
// Org / Project / Room assignment endpoints. Rejection is uniform 404
// with "Profile not found" so cross-org existence isn't leaked.

import { prisma } from "@/lib/prisma";
import { ProfileInheritance } from "@woodcraft/shared";

export interface ProfileAssignmentPatch {
  construction?: string | null;
  material?: string | null;
  hardware?: string | null;
}

/** Verifies each non-null profile ID in the patch belongs to the given
 *  org. Returns `null` on success, or the string "not_found" on failure
 *  (the caller renders the uniform 404). */
export async function verifyProfileTenancy(
  patch: ProfileAssignmentPatch,
  ctxOrgId: string,
): Promise<null | "not_found"> {
  // Construction
  if (typeof patch.construction === "string" && patch.construction.length > 0) {
    const row = await prisma.constructionProfile.findFirst({
      where: { id: patch.construction, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = ProfileInheritance.assertProfileBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }
  // Material
  if (typeof patch.material === "string" && patch.material.length > 0) {
    const row = await prisma.cabinetMaterialProfile.findFirst({
      where: { id: patch.material, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = ProfileInheritance.assertProfileBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }
  // Hardware
  if (typeof patch.hardware === "string" && patch.hardware.length > 0) {
    const row = await prisma.hardwareProfile.findFirst({
      where: { id: patch.hardware, orgId: ctxOrgId },
      select: { id: true, orgId: true },
    });
    const check = ProfileInheritance.assertProfileBelongsToOrg(row, ctxOrgId);
    if (!check.ok) return "not_found";
  }
  return null;
}
