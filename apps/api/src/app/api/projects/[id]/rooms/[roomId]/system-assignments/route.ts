// Phase 2 — Room cabinet-system-assignment GET / PATCH.

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

type Params = { params: { id: string; roomId: string } };

async function findOwned(roomId: string, projectId: string, orgId: string) {
  return prisma.room.findFirst({
    where: { id: roomId, projectId, orgId },
    select: { metadata: true },
  });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  const row = await findOwned(params.roomId, params.id, orgId);
  if (!row) return apiError("Room not found", 404);
  return ok(readAssignmentsFromMetadata(row.metadata) ?? {});
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const row = await findOwned(params.roomId, params.id, orgId);
  if (!row) return apiError("Room not found", 404);

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

  const nextMetadata = mergeMetadataAssignmentsPatch(
    row.metadata as Record<string, unknown> | null,
    parsed.data,
  );

  await prisma.room.update({
    where: { id: params.roomId },
    data: { metadata: nextMetadata === null ? Prisma.DbNull : (nextMetadata as never) },
  });

  return ok(readAssignmentsFromMetadata(nextMetadata) ?? {});
}
