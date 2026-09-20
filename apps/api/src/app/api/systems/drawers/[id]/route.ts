// Phase 2 — DrawerSystem GET / PATCH / DELETE. PATCH runs candidate-state
// validation: apply patch to existing row, then validate against the
// CREATE discriminated-union schema so kind transitions must strip stale
// fields from the other variant.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import {
  buildDrawerSystemCandidate,
  drawerSystemCreateSchema,
  drawerSystemPatchSchema,
} from "@woodcraft/shared";
import { buildSystemUpdatePayload, normalizeDrawerSystemRow } from "@/lib/systems";
import {
  canManageOrganizationStandards,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
} from "@/lib/authz";

type Params = { params: { id: string } };

async function findOwned(id: string, orgId: string) {
  return prisma.drawerSystem.findFirst({ where: { id, orgId } });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  const row = await findOwned(params.id, orgId);
  if (!row) return apiError("Drawer system not found", 404);
  return ok(normalizeDrawerSystemRow(row));
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Drawer system not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = drawerSystemPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const normalized = normalizeDrawerSystemRow(existing);
  if (!normalized) return apiError("Drawer system not found", 404);

  const candidate = buildDrawerSystemCandidate({
    existing: {
      kind: normalized.kind as "traditional" | "proprietary",
      name: normalized.name as string,
      description: (normalized.description as string | null) ?? null,
      boxSideThicknessMm:     normalized.boxSideThicknessMm as number | null,
      boxBottomThicknessMm:   normalized.boxBottomThicknessMm as number | null,
      boxBackThicknessMm:     normalized.boxBackThicknessMm as number | null,
      boxSubFrontThicknessMm: normalized.boxSubFrontThicknessMm as number | null,
      boxJoinery:             (normalized.boxJoinery as string | null) as never,
      proprietaryFamily:      (normalized.proprietaryFamily as string | null),
    },
    patch: parsed.data as Record<string, unknown>,
  });

  const candidateCheck = drawerSystemCreateSchema.safeParse(candidate);
  if (!candidateCheck.success) {
    return apiError(
      "Candidate state invalid — kind-transition would leave stale fields. " +
        candidateCheck.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const data = buildSystemUpdatePayload({
    kind: "drawer_system",
    existing: { fieldProvenance: existing.fieldProvenance as Record<string, unknown> | null },
    parsed: parsed.data,
  });

  const updated = await prisma.drawerSystem.update({ where: { id: params.id }, data });
  return ok(normalizeDrawerSystemRow(updated));
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  const existing = await findOwned(params.id, orgId);
  if (!existing) return apiError("Drawer system not found", 404);

  await prisma.drawerSystem.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
