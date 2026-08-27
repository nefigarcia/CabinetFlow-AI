import type { SceneAssetInstance as PrismaSceneAssetInstance } from "@woodcraft/db";
import type { SceneAssetInstance } from "@woodcraft/shared";

// Single serializer for GET / POST / PATCH responses — every scene-asset
// route returns the same JSON shape, matching the shared
// `SceneAssetInstance` type. Converts Prisma `Decimal` columns to plain
// numbers (per the existing cabinet convention — see
// `apps/api/src/app/api/projects/[id]/rooms/[roomId]/cabinets/route.ts`).
//
// Prisma `Json?` columns are already deserialized by Prisma Client into
// JS objects/values, so materialOverrides passes through as-is (narrowed
// to Record<string, string> at the type boundary — we validate on write).

export function serializeSceneAssetInstance(
  row: PrismaSceneAssetInstance,
): SceneAssetInstance {
  const materialOverrides =
    row.materialOverrides && typeof row.materialOverrides === "object" && !Array.isArray(row.materialOverrides)
      ? (row.materialOverrides as Record<string, string>)
      : undefined;

  return {
    id: row.id,
    orgId: row.orgId,
    roomId: row.roomId,
    assetDefinitionId: row.assetDefinitionId,
    positionMm: {
      x: Number(row.posX),
      y: Number(row.posY),
      z: Number(row.posZ),
    },
    rotationDeg: {
      x: Number(row.rotX),
      y: Number(row.rotY),
      z: Number(row.rotZ),
    },
    scale: {
      x: Number(row.scaleX),
      y: Number(row.scaleY),
      z: Number(row.scaleZ),
    },
    visible: row.visible,
    materialOverrides,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
