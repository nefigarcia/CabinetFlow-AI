// Phase 2 — Organization cabinet-system-assignment GET / PATCH.
// Assignments live inside Organization.metadata.cabinetSystemAssignments.

import { NextRequest } from "next/server";
import { Prisma } from "@woodcraft/db";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import {
  cabinetSystemAssignmentsPatchSchema,
  mergeMetadataAssignmentsPatch,
  readAssignmentsFromMetadata,
} from "@woodcraft/shared";
import { verifySystemAssignmentTenancy } from "@/lib/system-assignment";

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true },
  });
  if (!row) return apiError("Organization not found", 404);

  const assignments = readAssignmentsFromMetadata(row.metadata) ?? {};
  return ok(assignments);
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = cabinetSystemAssignmentsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const tenancy = await verifySystemAssignmentTenancy(parsed.data, orgId);
  if (tenancy) return apiError("Not found", 404);

  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true },
  });
  if (!row) return apiError("Organization not found", 404);

  const nextMetadata = mergeMetadataAssignmentsPatch(
    row.metadata as Record<string, unknown> | null,
    parsed.data,
  );

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      metadata: nextMetadata === null ? Prisma.DbNull : (nextMetadata as never),
    },
  });

  const assignments = readAssignmentsFromMetadata(nextMetadata) ?? {};
  return ok(assignments);
}
