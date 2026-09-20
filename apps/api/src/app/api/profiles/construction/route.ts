// Construction profiles — org-scoped CRUD list + create.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { constructionProfileWriteSchema } from "@woodcraft/shared";
import { convertJsonNulls } from "@/lib/profiles";

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("verificationStatus");

  const rows = await prisma.constructionProfile.findMany({
    where: { orgId, ...(statusParam ? { verificationStatus: statusParam } : {}) },
    orderBy: [{ name: "asc" }],
  });
  return ok(rows);
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

  const parsed = constructionProfileWriteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const created = await prisma.constructionProfile.create({
    data: convertJsonNulls({ ...parsed.data, orgId }) as never,
  });
  return ok(created, 201);
}
