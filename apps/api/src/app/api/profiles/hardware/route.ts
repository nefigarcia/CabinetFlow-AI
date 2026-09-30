// Hardware profiles — org-scoped CRUD list + create.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { hardwareProfileWriteSchema } from "@woodcraft/shared";
import { convertJsonNulls } from "@/lib/profiles";
import {
  canManageOrganizationLibrary,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_MANAGE_LIBRARY,
} from "@/lib/authz";

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("verificationStatus");

  const rows = await prisma.hardwareProfile.findMany({
    where: { orgId, ...(statusParam ? { verificationStatus: statusParam } : {}) },
    orderBy: [{ name: "asc" }],
  });
  return ok(rows);
}

export async function POST(req: NextRequest): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canManageOrganizationLibrary(role)) {
    return apiError(FORBIDDEN_MESSAGE_MANAGE_LIBRARY, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = hardwareProfileWriteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const created = await prisma.hardwareProfile.create({
    data: convertJsonNulls({ ...parsed.data, orgId }) as never,
  });
  return ok(created, 201);
}
