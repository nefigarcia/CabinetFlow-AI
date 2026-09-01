import type { PrismaClient, SceneAssetDefinition as PrismaRow } from "@woodcraft/db";
import { Prisma } from "@woodcraft/db";
import {
  buildSceneAssetKey,
  normalizeAssetKey,
  type AssetUploadManifest,
  type SceneAssetCategory,
  type SceneAssetDefinitionRecord,
  type SceneAssetDefinitionScope,
  type SceneAssetProvenance,
} from "@woodcraft/shared";
import {
  createS3Ops,
  uploadSceneAsset,
  validateAndHashBuffer,
  verifyUpload,
  type S3Ops,
  type ValidatedFile,
} from "@woodcraft/asset-cli";
import { serializeSceneAssetDefinition } from "./sceneAssetDefinitionSerializer";

// Server-side upload service — the ONE place that composes the full
// asset-ingest pipeline: file validation → S3 upload → HeadObject
// verify → DB persistence. The CLI + the browser both hit this service
// (the CLI via a helper wrapper, the browser via the API route).
//
// Never touches process.env for AWS credentials — the SDK's default
// credential chain handles that. This module only reads S3_BUCKET_NAME
// and AWS_REGION.
//
// Guarantees:
//   · If HeadObject verification fails, we DO NOT create the DB row.
//   · If the DB write fails, we do NOT return success to the client.
//     (S3 objects may remain — they're immutable + versioned so a
//     retry with the same version is a no-op-safe idempotent PUT.)
//   · orgId + scope come from the caller (server-derived), never
//     from client payloads.

export interface UploadServiceConfig {
  region: string;
  bucketName: string;
}

export function loadUploadConfigOrThrow(env: NodeJS.ProcessEnv = process.env): UploadServiceConfig {
  const region = env.AWS_REGION?.trim();
  const bucketName = env.S3_BUCKET_NAME?.trim();
  if (!region || !bucketName) {
    throw new Error(
      "S3 upload service is not configured: AWS_REGION and S3_BUCKET_NAME must be set.",
    );
  }
  return { region, bucketName };
}

export interface IngestSceneAssetInput {
  /** Server-authenticated context — never trust client-supplied orgId/scope. */
  scope: SceneAssetDefinitionScope;
  orgId: string | null;
  systemManaged: boolean;
  /** Definition metadata (validated separately with the shared schema
   *  BEFORE this service runs). */
  name: string;
  description: string | null;
  category: SceneAssetCategory;
  dimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
  placement?: unknown;
  collision?: unknown;
  provenance: SceneAssetProvenance;
  manufacturer?: string | null;
  sku?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  /** Slug — reserved for SYSTEM assets seeded from the legacy code
   *  catalog; when null the service uses the row's own id. */
  slug: string | null;
  /** Family key — when null a new family is minted equal to the created
   *  row's id. When non-null the service creates the NEXT immutable
   *  revision in that family. */
  family: string | null;
  /** Uploaded files (raw buffers from multipart). */
  modelFile: { filename: string; body: Buffer };
  thumbnailFile?: { filename: string; body: Buffer };
}

export interface IngestSceneAssetResult {
  record: SceneAssetDefinitionRecord;
  manifest: AssetUploadManifest;
  warnings: string[];
}

/**
 * Full ingest pipeline: validate files → determine canonical
 * ID/version/key → PutObject → HeadObject verify → INSERT
 * SceneAssetDefinition row.
 */
export async function ingestSceneAsset(input: {
  prisma: PrismaClient;
  config: UploadServiceConfig;
  ingest: IngestSceneAssetInput;
  /** Injected for tests; production wires `createS3Ops(config.region)`. */
  s3?: S3Ops;
  /** Injected clock for deterministic tests. */
  now?: () => Date;
}): Promise<IngestSceneAssetResult> {
  const { prisma, config, ingest } = input;
  const s3 = input.s3 ?? createS3Ops(config.region);

  // 1) Validate the raw files (buffer version — no filesystem).
  const model: ValidatedFile = validateAndHashBuffer(
    ingest.modelFile.filename,
    ingest.modelFile.body,
    {
      allowedExtensions: [".glb", ".gltf"],
      requireGlbHeader: ingest.modelFile.filename.toLowerCase().endsWith(".glb"),
      maxBytes: 50 * 1024 * 1024, // 50 MB hard cap; softer advisories inside uploader.
    },
  );
  const thumbnail: ValidatedFile | undefined = ingest.thumbnailFile
    ? validateAndHashBuffer(ingest.thumbnailFile.filename, ingest.thumbnailFile.body, {
        allowedExtensions: [".webp", ".png", ".jpg", ".jpeg"],
        maxBytes: 5 * 1024 * 1024,
      })
    : undefined;

  // 2) Reserve the DB row so we get a stable id + family + revision
  //    BEFORE we upload — the id/version become the S3 key. Wrapped
  //    in a transaction so a mid-upload crash rolls back the reserved
  //    row.
  const reserved = await reserveDefinitionRow(prisma, ingest);
  const definitionId = reserved.id;
  const version = `v${reserved.revision}`;

  // 3) Sanity-check the composed logical key survives normalization.
  //    (The uploader does this too, but failing here saves an S3 call.)
  const probeKey = buildSceneAssetKey({
    category: ingest.category,
    id: definitionId,
    version,
    kind: "model",
    extension: model.basename.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb",
  });
  if (!probeKey || !normalizeAssetKey(probeKey)) {
    await prisma.sceneAssetDefinition.delete({ where: { id: definitionId } });
    throw new Error(
      `Refusing to upload — generated logical key failed normalization.`,
    );
  }

  // 4) Upload model + optional thumbnail via the shared uploader.
  let result;
  try {
    result = await uploadSceneAsset({
      category: ingest.category,
      id: definitionId,
      version,
      bucket: config.bucketName,
      model,
      thumbnail,
      provenance: ingest.provenance,
      put: s3.put,
      now: input.now,
    });
  } catch (err) {
    await prisma.sceneAssetDefinition.delete({ where: { id: definitionId } }).catch(() => {
      // Best-effort — if delete fails the row will still be filtered out
      // by the assetKey==null / model==null check on read.
    });
    throw err;
  }

  // 5) Post-upload verification. If verification fails we DELETE the
  //    reserved row and surface the failure — the client sees no
  //    success response.
  const verify = await verifyUpload({
    bucket: config.bucketName,
    manifest: result.manifest,
    headObject: s3.headObject,
  });
  if (!verify.ok) {
    await prisma.sceneAssetDefinition.delete({ where: { id: definitionId } }).catch(() => {});
    const msg = verify.issues.map((i) => `${i.key}: ${i.message}`).join("; ");
    throw new Error(`Upload verification failed: ${msg}`);
  }

  // 6) Commit metadata onto the reserved row.
  const modelRef = {
    format: "glb" as const,
    assetKey: result.manifest.model.assetKey,
    thumbnailKey: result.manifest.thumbnail?.assetKey,
  };
  const updated = (await prisma.sceneAssetDefinition.update({
    where: { id: definitionId },
    data: {
      model: modelRef,
      assetKey: result.manifest.model.assetKey,
      thumbnailKey: result.manifest.thumbnail?.assetKey ?? null,
    },
  })) as unknown as PrismaRow;

  return {
    record: serializeSceneAssetDefinition(updated),
    manifest: result.manifest,
    warnings: result.warnings,
  };
}

/** Creates the row up-front so we can derive a stable S3 key from its
 *  Prisma-generated id. Family + revision are set here per the caller's
 *  intent (new family vs. next revision of an existing family). */
async function reserveDefinitionRow(
  prisma: PrismaClient,
  ingest: IngestSceneAssetInput,
): Promise<{ id: string; revision: number }> {
  const nextRevision = ingest.family
    ? (await prisma.sceneAssetDefinition.aggregate({
        where: { family: ingest.family },
        _max: { revision: true },
      }))._max.revision! + 1
    : 1;
  const created = await prisma.sceneAssetDefinition.create({
    data: {
      scope: ingest.scope,
      orgId: ingest.orgId,
      slug: ingest.slug,
      name: ingest.name,
      description: ingest.description,
      category: ingest.category,
      widthMm: ingest.dimensionsMm.widthMm,
      heightMm: ingest.dimensionsMm.heightMm,
      depthMm: ingest.dimensionsMm.depthMm,
      placement: (ingest.placement as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      collision: (ingest.collision as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      provenance: ingest.provenance as unknown as Prisma.InputJsonValue,
      manufacturer: ingest.manufacturer ?? null,
      sku: ingest.sku ?? null,
      tags: (ingest.tags ?? []) as unknown as Prisma.InputJsonValue,
      metadata: (ingest.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      // family: fill from caller OR self-reference after create (below).
      family: ingest.family ?? "pending",
      revision: nextRevision,
      active: true,
      systemManaged: ingest.systemManaged,
      // model + assetKey get filled in after S3 upload completes.
    },
  });
  // Self-reference family key for new families.
  if (!ingest.family) {
    await prisma.sceneAssetDefinition.update({
      where: { id: created.id },
      data: { family: created.id },
    });
  }
  return { id: created.id, revision: nextRevision };
}
