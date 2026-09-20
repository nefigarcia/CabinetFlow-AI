// Project-level profile-override assignment.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import {
  assignProfilesToProjectSchema,
  buildPartialPrismaUpdate,
} from "@woodcraft/shared";
import { verifyProfileTenancy } from "@/lib/profile-assignment";

type Params = { params: { id: string } };

const FIELDS = [
  "constructionProfileId",
  "materialProfileId",
  "hardwareProfileId",
] as const;

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const row = await prisma.project.findFirst({
    where: { id: params.id, orgId },
    select: {
      constructionProfileId: true,
      materialProfileId:     true,
      hardwareProfileId:     true,
    },
  });
  if (!row) return apiError("Project not found", 404);
  return ok(row);
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const project = await prisma.project.findFirst({
    where: { id: params.id, orgId },
    select: { id: true },
  });
  if (!project) return apiError("Project not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = assignProfilesToProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const tenancy = await verifyProfileTenancy(
    {
      construction: parsed.data.constructionProfileId,
      material:     parsed.data.materialProfileId,
      hardware:     parsed.data.hardwareProfileId,
    },
    orgId,
  );
  if (tenancy) return apiError("Profile not found", 404);

  const data = buildPartialPrismaUpdate(parsed.data, FIELDS);
  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
    select: {
      constructionProfileId: true,
      materialProfileId:     true,
      hardwareProfileId:     true,
    },
  });
  return ok(updated);
}
