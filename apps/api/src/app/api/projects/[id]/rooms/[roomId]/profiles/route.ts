// Room-level profile-override assignment.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import {
  assignProfilesToRoomSchema,
  buildPartialPrismaUpdate,
} from "@woodcraft/shared";
import { verifyProfileTenancy } from "@/lib/profile-assignment";

type Params = { params: { id: string; roomId: string } };

const FIELDS = [
  "constructionProfileId",
  "materialProfileId",
  "hardwareProfileId",
] as const;

async function findOwnedRoom(roomId: string, projectId: string, orgId: string) {
  return prisma.room.findFirst({ where: { id: roomId, projectId, orgId } });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const row = await findOwnedRoom(params.roomId, params.id, orgId);
  if (!row) return apiError("Room not found", 404);

  return ok({
    constructionProfileId: row.constructionProfileId,
    materialProfileId:     row.materialProfileId,
    hardwareProfileId:     row.hardwareProfileId,
  });
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const room = await findOwnedRoom(params.roomId, params.id, orgId);
  if (!room) return apiError("Room not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = assignProfilesToRoomSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
      "VALIDATION_ERROR",
    );
  }

  const tenancy = await verifyProfileTenancy(
    {
      construction: parsed.data.constructionProfileId,
      material:     parsed.data.materialProfileId,
      hardware:     parsed.data.hardwareProfileId,
    },
    orgId,
  );
  if (tenancy) return apiError("Profile not found", 404);

  const data = buildPartialPrismaUpdate(parsed.data, FIELDS);
  const updated = await prisma.room.update({
    where: { id: params.roomId },
    data,
    select: {
      constructionProfileId: true,
      materialProfileId:     true,
      hardwareProfileId:     true,
    },
  });
  return ok(updated);
}
