import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/scenePlatformAdmin";
import { serializeSceneAssetDefinition } from "@/lib/sceneAssetDefinitionSerializer";
import {
  canReadSceneAssetDefinition,
  canWriteSceneAssetDefinition,
  sceneAssetDefinitionPatchSchema,
} from "@woodcraft/shared";

// GET / PATCH / DELETE for a single scene asset definition.
//
// GET returns the row (with tenancy check).
// PATCH edits metadata only. Model replacement goes through
// POST /scene-asset-definitions/[id]/revise which creates a new
// immutable version.
// DELETE is soft — sets active=false. Hard-delete only when the row
// has no SceneAssetInstance references (see [id]/route.ts DELETE
// implementation) AND is explicitly force=true.

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);
  const row = await prisma.sceneAssetDefinition.findUnique({ where: { id: params.id } });
  if (!row) return apiError("Not found", 404);
  const record = serializeSceneAssetDefinition(row);
  if (!canReadSceneAssetDefinition(record, { orgId: ctx.orgId, isPlatformAdmin: isPlatformAdmin(ctx) })) {
    return apiError("Not found", 404); // do not leak cross-org existence
  }
  return ok(record);
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const row = await prisma.sceneAssetDefinition.findUnique({ where: { id: params.id } });
  if (!row) return apiError("Not found", 404);
  const record = serializeSceneAssetDefinition(row);
  const requester = { orgId: ctx.orgId, isPlatformAdmin: isPlatformAdmin(ctx) };
  if (!canReadSceneAssetDefinition(record, requester)) return apiError("Not found", 404);
  if (!canWriteSceneAssetDefinition(record, requester)) return apiError("Forbidden", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = sceneAssetDefinitionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      422,
      "VALIDATION_ERROR",
    );
  }
  const patch = parsed.data;

  // JSON blob fields — Prisma's `Json` accepts `undefined` (leave alone),
  // objects (replace), or `null` (clear). Convert `null` inputs → clear.
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.dimensionsMm !== undefined) {
    data.widthMm = patch.dimensionsMm.widthMm;
    data.heightMm = patch.dimensionsMm.heightMm;
    data.depthMm = patch.dimensionsMm.depthMm;
  }
  if (patch.placement !== undefined) data.placement = patch.placement ?? null;
  if (patch.collision !== undefined) data.collision = patch.collision ?? null;
  if (patch.provenance !== undefined) data.provenance = patch.provenance ?? null;
  if (patch.manufacturer !== undefined) data.manufacturer = patch.manufacturer;
  if (patch.sku !== undefined) data.sku = patch.sku;
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.metadata !== undefined) data.metadata = patch.metadata ?? null;
  if (patch.thumbnailKey !== undefined) data.thumbnailKey = patch.thumbnailKey;
  if (patch.active !== undefined) data.active = patch.active;

  const updated = await prisma.sceneAssetDefinition.update({
    where: { id: params.id },
    data,
  });
  return ok(serializeSceneAssetDefinition(updated));
}

/**
 * DELETE = SOFT-DELETE (active=false) by default. Hard-delete only when
 * `?force=true` AND no SceneAssetInstances reference this row (by id
 * OR by slug — legacy code-catalog compatibility).
 *
 * Soft-delete never touches S3 (files stay for existing instances to
 * keep resolving). Hard-delete leaves S3 untouched too — catalog
 * cleanup happens through a separate admin flow because bucket writes
 * are conservative on purpose.
 */
export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const row = await prisma.sceneAssetDefinition.findUnique({ where: { id: params.id } });
  if (!row) return apiError("Not found", 404);
  const record = serializeSceneAssetDefinition(row);
  const requester = { orgId: ctx.orgId, isPlatformAdmin: isPlatformAdmin(ctx) };
  if (!canReadSceneAssetDefinition(record, requester)) return apiError("Not found", 404);
  if (!canWriteSceneAssetDefinition(record, requester)) return apiError("Forbidden", 403);

  const force = new URL(req.url).searchParams.get("force") === "true";
  if (!force) {
    const updated = await prisma.sceneAssetDefinition.update({
      where: { id: params.id },
      data: { active: false },
    });
    return ok({ archived: true, record: serializeSceneAssetDefinition(updated) });
  }

  // Force delete — only when there are zero referencing instances.
  const usage = await countUsage(record.id, record.slug ?? undefined);
  if (usage > 0) {
    return apiError(
      `Cannot hard-delete: ${usage} SceneAssetInstance(s) still reference this definition. Archive instead (default DELETE without ?force=true).`,
      409,
    );
  }
  await prisma.sceneAssetDefinition.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}

async function countUsage(definitionId: string, slug: string | undefined): Promise<number> {
  const orIds = [definitionId, ...(slug ? [slug] : [])];
  return prisma.sceneAssetInstance.count({
    where: { assetDefinitionId: { in: orIds } },
  });
}
