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
  explainPlacementRejection,
  resolveDefinitionForPlacement,
  resolveLegacyStaticDefinition,
} from "@/lib/sceneAssetDefinitionResolver";
import {
  getRoomArchitecture,
  normalizeInstancePlacement,
} from "@woodcraft/shared";

type Params = { params: { id: string; roomId: string } };

/** Multi-tenant guard: matches the exact pattern used by cabinet routes. */
async function assertRoom(roomId: string, projectId: string, orgId: string) {
  return prisma.room.findFirst({ where: { id: roomId, projectId, orgId } });
}

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

  // Definition authority: DB is the runtime source of truth. The
  // resolver enforces tenancy (system OR own-org) + active-only rules.
  // Legacy `DEFAULT_SCENE_ASSET_CATALOG` ids are accepted as a
  // read-only compatibility bridge for SYSTEM slugs seeded into the
  // static catalog — this keeps a fresh install with no DB seed still
  // able to place primitives from code.
  const assetDefinitionId = parsed.data.assetDefinitionId;
  const dbResolved = await resolveDefinitionForPlacement({
    prisma,
    definitionId: assetDefinitionId,
    orgId,
  });
  if (!dbResolved) {
    const legacy = resolveLegacyStaticDefinition(assetDefinitionId);
    if (!legacy) {
      // Distinguish not-found vs archived vs no-access with a targeted
      // second query — so the client can show a specific message.
      const explain = await explainPlacementRejection({
        prisma,
        definitionId: assetDefinitionId,
        orgId,
      });
      return apiError(explain.message, explain.status, "DEFINITION_UNAVAILABLE");
    }
    // Legacy static definition — placement is allowed for backwards
    // compatibility. No further authorization needed (static entries
    // are SYSTEM by design).
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
