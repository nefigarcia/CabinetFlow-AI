import { z } from "zod";
import { SCENE_ASSET_PREFIX, normalizeAssetKey } from "./asset-url";
import type { SceneAssetCategory } from "./scene-asset-category";
import { sceneAssetCategorySchema } from "./scene-asset-category";
import type { SceneAssetProvenance } from "./scene-asset-definition";
import { sceneAssetProvenanceSchema } from "./scene-asset-definition";

export { SCENE_ASSET_PREFIX };

// Pure helpers used by the asset-upload CLI + any future admin UI.
//
// Nothing here talks to AWS — the CLI wires these outputs into an S3
// PutObject. Keeping the planning pure means:
//   · the CLI's core logic is unit-tested without AWS
//   · a future browser-side admin UI could reuse the same helpers
//   · the key layout is derived in ONE place (matches the docs)

// ─── Extension → MIME map ───────────────────────────────────────────────

export const SCENE_ASSET_MODEL_EXT_TO_MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

export const SCENE_ASSET_THUMBNAIL_EXT_TO_MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** Returns null for unsupported extensions (caller reports a validation error). */
export function pickModelContentType(filename: string): string | null {
  return SCENE_ASSET_MODEL_EXT_TO_MIME[extname(filename)] ?? null;
}

export function pickThumbnailContentType(filename: string): string | null {
  return SCENE_ASSET_THUMBNAIL_EXT_TO_MIME[extname(filename)] ?? null;
}

function extname(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

// ─── Upload key generation ──────────────────────────────────────────────

/** Cache-Control header set on every uploaded GLB / thumbnail. Both
 *  files use versioned keys so long-lived immutable caching is safe. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable" as const;

/** Slug-safety: kebab-case, alnum + hyphen + underscore. */
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

/** Version-safety: e.g. `v1`, `v2`, `v10`. Callers may also pass a
 *  content-hash-derived identifier (git-style short hash). */
const SAFE_VERSION_RE = /^[a-z0-9][a-z0-9_-]*$/;

export interface UploadKeyInput {
  category: SceneAssetCategory;
  /** Definition id / slug — determines the folder under the category. */
  id: string;
  /** Version tag (e.g. `v1`, or a content hash). */
  version: string;
  /** File-shape being uploaded. Determines the filename. */
  kind: "model" | "thumbnail";
  /** Extension including the dot (e.g. `.glb`, `.webp`). */
  extension: string;
}

/**
 * Composes the canonical LOGICAL assetKey for a scene asset file.
 *
 * Layout: `<category>/<id>/<version>/<filename>` — no `scene/` prefix.
 * This is exactly what gets stored in `SceneAssetDefinition.model.assetKey`
 * and printed to the developer. The physical S3 key adds `scene/` via
 * `toS3ObjectKey`.
 *
 * Filenames are stable per kind (`model.glb`, `thumbnail.webp`) so the
 * asset-key stored in the catalog stays predictable across versions.
 *
 * Returns null when any input fails validation.
 */
export function buildSceneAssetKey(input: UploadKeyInput): string | null {
  if (!validateUploadKeyInput(input)) return null;
  const baseFilename = input.kind === "model" ? "model" : "thumbnail";
  const filename = `${baseFilename}${input.extension.toLowerCase()}`;
  return `${input.category}/${input.id}/${input.version}/${filename}`;
}

/** True when all fields pass slug/extension safety checks. */
export function validateUploadKeyInput(input: UploadKeyInput): boolean {
  if (!sceneAssetCategorySchema.safeParse(input.category).success) return false;
  if (!SAFE_SLUG_RE.test(input.id)) return false;
  if (!SAFE_VERSION_RE.test(input.version)) return false;
  const mime =
    input.kind === "model"
      ? pickModelContentType(`x${input.extension}`)
      : pickThumbnailContentType(`x${input.extension}`);
  if (!mime) return false;
  // Composed LOGICAL key must survive normalization — belt-and-suspenders.
  const composed = `${input.category}/${input.id}/${input.version}/${input.kind === "model" ? "model" : "thumbnail"}${input.extension.toLowerCase()}`;
  if (normalizeAssetKey(composed) !== composed) return false;
  return true;
}

// ─── Asset manifest ─────────────────────────────────────────────────────
//
// The manifest is a JSON sidecar the upload CLI writes to the artifact
// folder. It is NEVER shipped to the browser — it exists so:
//   · CI/audit tools can prove every uploaded asset carries a license.
//   · A future re-upload can recover the assetKey / thumbnailKey without
//     re-deriving them from filesystem state.
//   · The developer can copy-paste the manifest into a new
//     SceneAssetDefinition entry safely.

export interface AssetUploadManifest {
  id: string;
  category: SceneAssetCategory;
  version: string;
  model: {
    assetKey: string;
    /** File size in bytes at upload time. */
    sizeBytes: number;
    /** SHA-256 hex digest computed by the CLI at upload time. */
    sha256: string;
    /** Content-Type used in the S3 PutObject. */
    contentType: string;
  };
  thumbnail?: {
    assetKey: string;
    sizeBytes: number;
    sha256: string;
    contentType: string;
  };
  provenance: SceneAssetProvenance;
  /** ISO timestamp of the upload. */
  uploadedAt: string;
}

export const assetUploadManifestSchema: z.ZodType<AssetUploadManifest> = z.object({
  id: z.string().min(1),
  category: sceneAssetCategorySchema,
  version: z.string().min(1),
  model: z.object({
    assetKey: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i),
    contentType: z.string().min(1),
  }),
  thumbnail: z
    .object({
      assetKey: z.string().min(1),
      sizeBytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/i),
      contentType: z.string().min(1),
    })
    .optional(),
  provenance: sceneAssetProvenanceSchema,
  uploadedAt: z.string().min(1),
});

// ─── File-size guidance ─────────────────────────────────────────────────

export const SIZE_ADVICE_MB = {
  simpleProp: 1,
  normalFurniture: 5,
  complexHero: 15,
} as const;

/** Advisory only — returns a warning string when the size exceeds the
 *  guidance for the given category. CLI prints; never blocks. */
export function fileSizeAdvice(sizeBytes: number, category: SceneAssetCategory): string | null {
  const mb = sizeBytes / (1024 * 1024);
  const softLimit =
    category === "decor" || category === "plant"
      ? SIZE_ADVICE_MB.simpleProp
      : category === "appliance" || category === "furniture" || category === "plumbing"
        ? SIZE_ADVICE_MB.normalFurniture
        : SIZE_ADVICE_MB.complexHero;
  if (mb <= softLimit) return null;
  return `Asset is ${mb.toFixed(1)} MB — exceeds the ${softLimit} MB soft budget for "${category}". Review before shipping.`;
}
