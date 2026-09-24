// Prisma-backed lookups for the shared Cabinet.parameters write gate
// (`gateCabinetParametersWrite` in @woodcraft/shared). Every lookup is
// org-scoped in the WHERE clause; the gate additionally asserts orgId.

import { prisma } from "@/lib/prisma";
import type { CabinetParameterRefLookup } from "@woodcraft/shared";

const idOrg = { id: true, orgId: true } as const;

export const prismaCabinetParameterRefLookup: CabinetParameterRefLookup = {
  constructionProfile: (id, orgId) =>
    prisma.constructionProfile.findFirst({ where: { id, orgId }, select: idOrg }),
  materialProfile: (id, orgId) =>
    prisma.cabinetMaterialProfile.findFirst({ where: { id, orgId }, select: idOrg }),
  hardwareProfile: (id, orgId) =>
    prisma.hardwareProfile.findFirst({ where: { id, orgId }, select: idOrg }),
  familyRule: (id, orgId) =>
    prisma.cabinetFamilyRule.findFirst({
      where: { id, orgId },
      select: { ...idOrg, cabinetType: true },
    }),
  frontSystem: (id, orgId) =>
    prisma.frontSystem.findFirst({ where: { id, orgId }, select: idOrg }),
  drawerSystem: (id, orgId) =>
    prisma.drawerSystem.findFirst({ where: { id, orgId }, select: idOrg }),
};
