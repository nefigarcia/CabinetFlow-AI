import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, updateSceneAssetInstanceSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import { serializeSceneAssetInstance } from "@/lib/sceneAssetSerializer";
import { Prisma } from "@woodcraft/db";

type Params = { params: { id: string; roomId: string; instanceId: string } };

async function assertRoom(roomId: string, projectId: string, orgId: string) {
  return prisma.room.findFirst({ where: { id: roomId, projectId, orgId } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  if (!(await assertRoom(params.roomId, params.id, orgId))) {
    return apiError("Room not found", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = parseBody(updateSceneAssetInstanceSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  // Ownership check: the instance must live in this exact room + org.
  // Lookup by id ALONE would allow a caller to modify any org's asset.
  const existing = await prisma.sceneAssetInstance.findFirst({
    where: { id: params.instanceId, roomId: params.roomId, orgId },
  });
  if (!existing) return apiError("Scene asset not found", 404);

  // Build the Prisma update payload from validated user-controllable fields
  // only. Tenancy is never patched. Scale is never patched (see Scale Policy).
  const data: Prisma.SceneAssetInstanceUpdateInput = {};
  if (parsed.data.positionMm) {
    data.posX = parsed.data.positionMm.x;
    data.posY = parsed.data.positionMm.y;
    data.posZ = parsed.data.positionMm.z;
  }
  if (parsed.data.rotationDeg) {
    data.rotX = parsed.data.rotationDeg.x;
    data.rotY = parsed.data.rotationDeg.y;
    data.rotZ = parsed.data.rotationDeg.z;
  }
  if (parsed.data.visible !== undefined) data.visible = parsed.data.visible;
  if (parsed.data.materialOverrides !== undefined) {
    // `null` clears the overrides; an object replaces them.
    data.materialOverrides =
      parsed.data.materialOverrides === null
        ? Prisma.DbNull
        : parsed.data.materialOverrides;
  }

  const updated = await prisma.sceneAssetInstance.update({
    where: { id: params.instanceId },
    data,
  });

  return ok(serializeSceneAssetInstance(updated));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { orgId } = getContext(_req);

  if (!(await assertRoom(params.roomId, params.id, orgId))) {
    return apiError("Room not found", 404);
  }

  // Same ownership guard as PATCH: lookup by (id + roomId + orgId).
  const existing = await prisma.sceneAssetInstance.findFirst({
    where: { id: params.instanceId, roomId: params.roomId, orgId },
  });
  if (!existing) return apiError("Scene asset not found", 404);

  await prisma.sceneAssetInstance.delete({ where: { id: params.instanceId } });

  return ok({ deleted: true });
}
