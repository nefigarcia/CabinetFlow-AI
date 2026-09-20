// Organization profile-default assignment. GET returns the org's
// current default IDs; PATCH sets or clears any subset.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { assignProfilesToOrgSchema } from "@woodcraft/shared";
import { buildPartialPrismaUpdate } from "@woodcraft/shared";
import { verifyProfileTenancy } from "@/lib/profile-assignment";

const FIELDS = [
  "defaultConstructionProfileId",
  "defaultMaterialProfileId",
  "defaultHardwareProfileId",
] as const;

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      defaultConstructionProfileId: true,
      defaultMaterialProfileId:     true,
      defaultHardwareProfileId:     true,
    },
  });
  if (!row) return apiError("Organization not found", 404);
  return ok(row);
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = assignProfilesToOrgSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const tenancy = await verifyProfileTenancy(
    {
      construction: parsed.data.defaultConstructionProfileId,
      material:     parsed.data.defaultMaterialProfileId,
      hardware:     parsed.data.defaultHardwareProfileId,
    },
    orgId,
  );
  if (tenancy) return apiError("Profile not found", 404);

  const data = buildPartialPrismaUpdate(parsed.data, FIELDS);
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
    select: {
      defaultConstructionProfileId: true,
      defaultMaterialProfileId:     true,
      defaultHardwareProfileId:     true,
    },
  });
  return ok(updated);
}
