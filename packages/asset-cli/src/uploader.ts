import {
  IMMUTABLE_CACHE_CONTROL,
  buildSceneAssetKey,
  fileSizeAdvice,
  pickModelContentType,
  pickThumbnailContentType,
  toS3ObjectKey,
  type AssetUploadManifest,
  type SceneAssetCategory,
  type SceneAssetProvenance,
} from "@woodcraft/shared";
import type { ValidatedFile } from "./file-validation";

// Uploader — narrow S3 boundary. The single dependency here is a
// `PutObjectFn` — we don't import the AWS SDK types directly so the
// tests can pass a plain mock without needing to construct a real
// S3Client.

export interface PutObjectRequest {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl: string;
  metadata?: Record<string, string>;
}

export interface PutObjectFn {
  (request: PutObjectRequest): Promise<void>;
}

export interface UploadInput {
  category: SceneAssetCategory;
  id: string;
  version: string;
  bucket: string;
  model: ValidatedFile;
  thumbnail?: ValidatedFile;
  provenance: SceneAssetProvenance;
  /** Injected — tests pass a mock. Production wires the real S3 client. */
  put: PutObjectFn;
  /** Injected — the CLI's `Date.now`; tests pass a stable clock. */
  now?: () => Date;
}

export interface UploadResult {
  manifest: AssetUploadManifest;
  /** Non-fatal warnings surfaced to the caller (e.g. size advice). */
  warnings: string[];
}

/**
 * Uploads a scene-asset model + optional thumbnail to S3.
 *
 * · Model MUST be `.glb` or `.gltf`.
 * · Thumbnail MUST be `.webp`, `.png`, or `.jpg/.jpeg`.
 * · Both PutObjects use IMMUTABLE_CACHE_CONTROL — keys are versioned
 *   under `scene/<category>/<id>/<version>/…` so this is safe.
 * · A manifest describing the upload (keys, sizes, sha256s, provenance,
 *   timestamp) is returned. The CLI writes it next to the source files
 *   so downstream `SceneAssetDefinition` edits can copy the keys.
 *
 * Throws when a file's Content-Type can't be resolved from its extension
 * or when the deterministic S3 key would violate safety rules.
 */
export async function uploadSceneAsset(input: UploadInput): Promise<UploadResult> {
  const modelExt = extname(input.model.basename);
  const modelContentType = pickModelContentType(input.model.basename);
  if (!modelContentType) {
    throw new Error(
      `Cannot resolve Content-Type for model "${input.model.basename}" (extension "${modelExt}").`,
    );
  }
  const modelAssetKey = buildSceneAssetKey({
    category: input.category,
    id: input.id,
    version: input.version,
    kind: "model",
    extension: modelExt,
  });
  const modelPhysicalKey = modelAssetKey ? toS3ObjectKey(modelAssetKey) : null;
  if (!modelAssetKey || !modelPhysicalKey) {
    throw new Error(
      `Refusing to upload — invalid category/id/version/extension for the S3 key. ` +
        `Check that id + version are kebab-case and the extension is .glb or .gltf.`,
    );
  }

  await input.put({
    bucket: input.bucket,
    key: modelPhysicalKey,
    body: input.model.body,
    contentType: modelContentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    metadata: provenanceToObjectMetadata(input.provenance),
  });

  let thumbnailEntry: AssetUploadManifest["thumbnail"];
  if (input.thumbnail) {
    const thumbExt = extname(input.thumbnail.basename);
    const thumbContentType = pickThumbnailContentType(input.thumbnail.basename);
    if (!thumbContentType) {
      throw new Error(
        `Cannot resolve Content-Type for thumbnail "${input.thumbnail.basename}" (extension "${thumbExt}").`,
      );
    }
    const thumbnailAssetKey = buildSceneAssetKey({
      category: input.category,
      id: input.id,
      version: input.version,
      kind: "thumbnail",
      extension: thumbExt,
    });
    const thumbnailPhysicalKey = thumbnailAssetKey ? toS3ObjectKey(thumbnailAssetKey) : null;
    if (!thumbnailAssetKey || !thumbnailPhysicalKey) {
      throw new Error(
        `Refusing to upload thumbnail — invalid extension. Allowed: .webp, .png, .jpg, .jpeg`,
      );
    }
    await input.put({
      bucket: input.bucket,
      key: thumbnailPhysicalKey,
      body: input.thumbnail.body,
      contentType: thumbContentType,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: provenanceToObjectMetadata(input.provenance),
    });
    thumbnailEntry = {
      assetKey: thumbnailAssetKey,
      sizeBytes: input.thumbnail.sizeBytes,
      sha256: input.thumbnail.sha256,
      contentType: thumbContentType,
    };
  }

  const now = (input.now ?? (() => new Date()))();
  const manifest: AssetUploadManifest = {
    id: input.id,
    category: input.category,
    version: input.version,
    model: {
      assetKey: modelAssetKey,
      sizeBytes: input.model.sizeBytes,
      sha256: input.model.sha256,
      contentType: modelContentType,
    },
    thumbnail: thumbnailEntry,
    provenance: input.provenance,
    uploadedAt: now.toISOString(),
  };

  const warnings: string[] = [];
  const modelAdvice = fileSizeAdvice(input.model.sizeBytes, input.category);
  if (modelAdvice) warnings.push(`Model: ${modelAdvice}`);
  if (input.thumbnail) {
    if (input.thumbnail.sizeBytes > 250_000) {
      warnings.push(
        `Thumbnail is ${(input.thumbnail.sizeBytes / 1024).toFixed(0)} KB — consider re-exporting under 250 KB.`,
      );
    }
  }

  return { manifest, warnings };
}

/** Provenance is copied into S3 object metadata (x-amz-meta-*) as an
 *  audit trail. Keys are lowercased per S3 convention; long/PII notes are
 *  intentionally NOT copied to avoid leaking author details in HTTP HEAD
 *  responses. */
function provenanceToObjectMetadata(p: SceneAssetProvenance): Record<string, string> {
  const out: Record<string, string> = {
    "source-name": p.sourceName,
    license: p.license,
  };
  if (p.author) out.author = p.author;
  if (p.acquiredAt) out["acquired-at"] = p.acquiredAt;
  return out;
}

function extname(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}
