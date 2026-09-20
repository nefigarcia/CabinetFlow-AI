// Phase 2 — DrawerSystem org-scoped list + create.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { drawerSystemCreateSchema } from "@woodcraft/shared";
import { convertJsonNulls, normalizeDrawerSystemRow } from "@/lib/systems";
import {
  canManageOrganizationStandards,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
} from "@/lib/authz";

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");

  const rows = await prisma.drawerSystem.findMany({
    where: { orgId, ...(kindParam ? { kind: kindParam } : {}) },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return ok(rows.map((r) => normalizeDrawerSystemRow(r)));
}

export async function POST(req: NextRequest): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationStandards(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_STANDARDS, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = drawerSystemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const created = await prisma.drawerSystem.create({
    data: convertJsonNulls({ ...parsed.data, orgId }) as never,
  });
  return ok(normalizeDrawerSystemRow(created), 201);
}
