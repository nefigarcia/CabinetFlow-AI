// Cabinet material profile — org-scoped GET / PATCH / DELETE.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { cabinetMaterialProfileWriteSchema } from "@woodcraft/shared";
import { buildProfileUpdatePayload } from "@/lib/profiles";

type Params = { params: { id: string } };

async function findOwned(id: string, orgId: string) {
  return prisma.cabinetMaterialProfile.findFirst({ where: { id, orgId } });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  const row = await findOwned(params.id, orgId);
  if (!row) return apiError("Profile not found", 404);
  return ok(row);
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Profile not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = cabinetMaterialProfileWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const data = buildProfileUpdatePayload({
    kind: "material",
    existing: { fieldProvenance: existing.fieldProvenance as Record<string, unknown> | null },
    parsed: parsed.data,
  });

  const updated = await prisma.cabinetMaterialProfile.update({
    where: { id: params.id },
    data,
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Profile not found", 404);

  await prisma.cabinetMaterialProfile.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
