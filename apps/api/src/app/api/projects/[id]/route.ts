import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, updateProjectSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import { canManageOrganizationStandards, FORBIDDEN_CODE } from "@/lib/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId } = getContext(req);

  const project = await prisma.project.findFirst({
    where: { id: params.id, orgId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      rooms: {
        include: {
          _count: { select: { cabinets: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { quotes: true, revisions: true, productionRuns: true } },
    },
  });
  if (!project) return apiError("Project not found", 404);

  return ok(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId } = getContext(req);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body", 400); }

  const parsed = parseBody(updateProjectSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const existing = await prisma.project.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Project not found", 404);

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: parsed.data,
    include: { client: { select: { id: true, name: true } } },
  });
  return ok(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { orgId, role } = getContext(req);
  // Cascade-deletes every room/cabinet/part/revision in the project — an
  // administrative, job-level action, NOT a cabinet-design mutation.
  // Owner/admin only (the existing owner/admin predicate); designers
  // and viewers forbidden.
  if (!canManageOrganizationStandards(role)) {
    return apiError("Only owners and admins can delete projects.", 403, FORBIDDEN_CODE);
  }

  const existing = await prisma.project.findFirst({ where: { id: params.id, orgId } });
  if (!existing) return apiError("Project not found", 404);

  // Cascade via Prisma schema (onDelete: Cascade on rooms → cabinets → parts)
  await prisma.project.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
