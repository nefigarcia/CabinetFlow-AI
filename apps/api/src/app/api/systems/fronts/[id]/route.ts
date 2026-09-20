// Phase 2 — FrontSystem GET / PATCH / DELETE.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { frontSystemPatchSchema } from "@woodcraft/shared";
import { buildSystemUpdatePayload } from "@/lib/systems";
import {
  canManageOrganizationStandards,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
} from "@/lib/authz";

type Params = { params: { id: string } };

async function findOwned(id: string, orgId: string) {
  return prisma.frontSystem.findFirst({ where: { id, orgId } });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  const row = await findOwned(params.id, orgId);
  if (!row) return apiError("Front system not found", 404);
  return ok(row);
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Front system not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = frontSystemPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const data = buildSystemUpdatePayload({
    kind: "front_system",
    existing: { fieldProvenance: existing.fieldProvenance as Record<string, unknown> | null },
    parsed: parsed.data,
  });

  const updated = await prisma.frontSystem.update({ where: { id: params.id }, data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Front system not found", 404);

  await prisma.frontSystem.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
