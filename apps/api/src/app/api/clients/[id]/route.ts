import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, updateClientSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import {
  canManageOrganizationStandards,
  canMutateDesignContent,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
} from "@/lib/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId } = getContext(req);

  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId },
    include: { projects: { select: { id: true, name: true, status: true } } },
  });
  if (!client) return apiError("Client not found", 404);

  return ok(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId, role } = getContext(req);
  if (!canMutateDesignContent(role)) {
    return apiError(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body", 400); }

  const parsed = parseBody(updateClientSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const existing = await prisma.client.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Client not found", 404);

  const updated = await prisma.client.update({ where: { id: params.id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId, role } = getContext(req);
  // Deleting a client is administrative — owner/admin only. Create/edit
  // stay open to designers (a client is a prerequisite for a project).
  if (!canManageOrganizationStandards(role)) {
    return apiError("Only owners and admins can delete clients.", 403, FORBIDDEN_CODE);
  }

  const existing = await prisma.client.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Client not found", 404);

  const projectCount = await prisma.project.count({ where: { clientId: params.id, orgId } });
  if (projectCount > 0) {
    return apiError(`Cannot delete client with ${projectCount} project(s). Archive or reassign them first.`, 409);
  }

  await prisma.client.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
