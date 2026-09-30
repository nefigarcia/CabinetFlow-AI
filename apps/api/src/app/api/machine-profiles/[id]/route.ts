import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, updateMachineProfileSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import {
  canManageOrganizationLibrary,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_LIBRARY,
} from "@/lib/authz";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { orgId } = getContext(req);
  const p = await prisma.machineProfile.findFirst({ where: { id: params.id, orgId } });
  if (!p) return apiError("Machine profile not found", 404);
  return ok(p);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { orgId, role } = getContext(req);
  if (!canManageOrganizationLibrary(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_LIBRARY, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body", 400); }

  const parsed = parseBody(updateMachineProfileSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const existing = await prisma.machineProfile.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Machine profile not found", 404);

  const updated = await prisma.machineProfile.update({ where: { id: params.id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { orgId, role } = getContext(req);
  if (!canManageOrganizationLibrary(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_LIBRARY, 403, FORBIDDEN_CODE);
  }
  const existing = await prisma.machineProfile.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Machine profile not found", 404);
  await prisma.machineProfile.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
