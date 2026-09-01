import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/scenePlatformAdmin";
import { serializeSceneAssetDefinition } from "@/lib/sceneAssetDefinitionSerializer";
import {
  ingestSceneAsset,
  loadUploadConfigOrThrow,
} from "@/lib/sceneAssetUploadService";
import {
  canReadSceneAssetDefinition,
  canWriteSceneAssetDefinition,
  sceneAssetDefinitionCreateSchema,
  type SceneAssetProvenance,
} from "@woodcraft/shared";

// POST /scene-asset-definitions/[id]/revise
//
// Creates a NEW immutable version of an existing family. The existing
// row keeps its assetKey; the new row gets a fresh id + incremented
// revision + the new S3 upload. Existing SceneAssetInstances that
// referenced the old id keep resolving to the old S3 object — geometry
// never silently changes.
//
// The client sends multipart form-data identical to the create route.

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const parent = await prisma.sceneAssetDefinition.findUnique({ where: { id: params.id } });
  if (!parent) return apiError("Not found", 404);
  const parentRecord = serializeSceneAssetDefinition(parent);
  const requester = { orgId: ctx.orgId, isPlatformAdmin: isPlatformAdmin(ctx) };
  if (!canReadSceneAssetDefinition(parentRecord, requester)) return apiError("Not found", 404);
  if (!canWriteSceneAssetDefinition(parentRecord, requester)) return apiError("Forbidden", 403);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return apiError("Expected multipart/form-data", 415);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return apiError(`Malformed multipart body: ${(err as Error).message}`, 400);
  }
  const metadataRaw = form.get("metadata");
  if (typeof metadataRaw !== "string") return apiError("Missing `metadata` field", 400);
  let metadata: unknown;
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (err) {
    return apiError(`Invalid metadata JSON: ${(err as Error).message}`, 400);
  }
  const parsed = sceneAssetDefinitionCreateSchema.safeParse(metadata);
  if (!parsed.success) {
    return apiError(
      `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      422,
      "VALIDATION_ERROR",
    );
  }
  const data = parsed.data;
  if (!data.provenance) return apiError("provenance is required for GLB uploads", 422);

  const modelFile = form.get("model");
  if (!(modelFile instanceof File)) return apiError("Missing `model` file", 400);
  const modelBuf = Buffer.from(await modelFile.arrayBuffer());
  const thumbnailFile = form.get("thumbnail");
  const thumbnailBuf =
    thumbnailFile instanceof File && thumbnailFile.size > 0
      ? Buffer.from(await thumbnailFile.arrayBuffer())
      : null;

  let config;
  try {
    config = loadUploadConfigOrThrow();
  } catch (err) {
    return apiError((err as Error).message, 500);
  }

  try {
    const result = await ingestSceneAsset({
      prisma,
      config,
      ingest: {
        scope: parentRecord.scope,
        orgId: parentRecord.orgId,
        systemManaged: parentRecord.systemManaged,
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        dimensionsMm: data.dimensionsMm,
        placement: data.placement,
        collision: data.collision,
        provenance: data.provenance as SceneAssetProvenance,
        manufacturer: data.manufacturer ?? null,
        sku: data.sku ?? null,
        tags: data.tags,
        metadata: data.metadata ?? null,
        // New revision INHERITS the parent's slug + family.
        slug: parentRecord.slug,
        family: parentRecord.family,
        modelFile: { filename: modelFile.name || "model.glb", body: modelBuf },
        thumbnailFile: thumbnailBuf
          ? { filename: (thumbnailFile as File).name || "thumbnail.webp", body: thumbnailBuf }
          : undefined,
      },
    });
    return ok({ record: result.record, warnings: result.warnings }, 201);
  } catch (err) {
    return apiError(`Revise failed: ${(err as Error).message}`, 500);
  }
}
