import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, createSceneAssetInstanceSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import {
  placementToColumns,
  serializeSceneAssetInstance,
} from "@/lib/sceneAssetSerializer";
import {
  DEFAULT_SCENE_ASSET_CATALOG,
  getRoomArchitecture,
  normalizeInstancePlacement,
} from "@woodcraft/shared";

type Params = { params: { id: string; roomId: string } };

/** Multi-tenant guard: matches the exact pattern used by cabinet routes. */
async function assertRoom(roomId: string, projectId: string, orgId: string) {
  return prisma.room.findFirst({ where: { id: roomId, projectId, orgId } });
}

/** Bootstrap catalog validation — no DB table for definitions in MVP. */
const KNOWN_DEFINITION_IDS = new Set(
  DEFAULT_SCENE_ASSET_CATALOG.map((d) => d.id),
);

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  if (!(await assertRoom(params.roomId, params.id, orgId))) {
    return apiError("Room not found", 404);
  }

  const rows = await prisma.sceneAssetInstance.findMany({
    where: { roomId: params.roomId, orgId },
    orderBy: { createdAt: "asc" },
  });

  return ok(rows.map(serializeSceneAssetInstance));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  const room = await assertRoom(params.roomId, params.id, orgId);
  if (!room) return apiError("Room not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = parseBody(createSceneAssetInstanceSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  // The catalog is in shared code (no DB FK). Reject unknown ids here so
  // we never persist arbitrary strings.
  if (!KNOWN_DEFINITION_IDS.has(parsed.data.assetDefinitionId)) {
    return apiError(
      `Unknown scene-asset definition: ${parsed.data.assetDefinitionId}`,
      422,
      "VALIDATION_ERROR",
    );
  }

  const placement = normalizeInstancePlacement(parsed.data.placement);
  if (placement.mode === "wall") {
    // getRoomArchitecture guards metadata shape internally; Prisma types
    // `metadata` as JsonValue which is wider than the domain expects.
    const arch = getRoomArchitecture({
      metadata: room.metadata as Record<string, unknown> | null,
      width: Number(room.width),
      height: Number(room.height),
      depth: Number(room.depth),
    });
    if (!arch.walls.some((w) => w.id === placement.wall!.wallId)) {
      return apiError(
        `Unknown wallId for wall attachment: ${placement.wall!.wallId}`,
        422,
        "VALIDATION_ERROR",
      );
    }
  }
  const cols = placementToColumns(placement);

  const row = await prisma.sceneAssetInstance.create({
    data: {
      orgId,
      roomId: params.roomId,
      assetDefinitionId: parsed.data.assetDefinitionId,
      posX: parsed.data.positionMm.x,
      posY: parsed.data.positionMm.y,
      posZ: parsed.data.positionMm.z,
      rotX: parsed.data.rotationDeg?.x ?? 0,
      rotY: parsed.data.rotationDeg?.y ?? 0,
      rotZ: parsed.data.rotationDeg?.z ?? 0,
      // Scale intentionally omitted — Prisma applies the schema defaults (1, 1, 1).
      visible: parsed.data.visible ?? true,
      placementMode: cols.placementMode,
      wallId: cols.wallId,
      wallLocalX: cols.wallLocalX,
      wallLocalY: cols.wallLocalY,
      wallLocalZ: cols.wallLocalZ,
      materialOverrides: parsed.data.materialOverrides ?? undefined,
    },
  });

  return ok(serializeSceneAssetInstance(row), 201);
}
