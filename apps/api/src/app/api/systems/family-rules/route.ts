// Phase 2 — CabinetFamilyRule org-scoped list + create.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { cabinetFamilyRuleCreateSchema } from "@woodcraft/shared";
import { convertJsonNulls, normalizeCabinetFamilyRuleRow } from "@/lib/systems";

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("cabinetType");

  const rows = await prisma.cabinetFamilyRule.findMany({
    where: { orgId, ...(typeParam ? { cabinetType: typeParam } : {}) },
    orderBy: [{ cabinetType: "asc" }, { name: "asc" }],
  });
  return ok(rows.map((r) => normalizeCabinetFamilyRuleRow(r)));
}

export async function POST(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = cabinetFamilyRuleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const created = await prisma.cabinetFamilyRule.create({
    data: convertJsonNulls({ ...parsed.data, orgId }) as never,
  });
  return ok(normalizeCabinetFamilyRuleRow(created), 201);
}
