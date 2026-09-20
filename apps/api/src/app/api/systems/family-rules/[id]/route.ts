// Phase 2 — CabinetFamilyRule GET / PATCH / DELETE.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { cabinetFamilyRulePatchSchema } from "@woodcraft/shared";
import { buildSystemUpdatePayload, normalizeCabinetFamilyRuleRow } from "@/lib/systems";
import {
  canManageOrganizationStandards,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
} from "@/lib/authz";

type Params = { params: { id: string } };

async function findOwned(id: string, orgId: string) {
  return prisma.cabinetFamilyRule.findFirst({ where: { id, orgId } });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  const row = await findOwned(params.id, orgId);
  if (!row) return apiError("Family rule not found", 404);
  return ok(normalizeCabinetFamilyRuleRow(row));
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Family rule not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = cabinetFamilyRulePatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const data = buildSystemUpdatePayload({
    kind: "cabinet_family_rule",
    existing: { fieldProvenance: existing.fieldProvenance as Record<string, unknown> | null },
    parsed: parsed.data,
  });

  const updated = await prisma.cabinetFamilyRule.update({ where: { id: params.id }, data });
  return ok(normalizeCabinetFamilyRuleRow(updated));
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Family rule not found", 404);

  await prisma.cabinetFamilyRule.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
