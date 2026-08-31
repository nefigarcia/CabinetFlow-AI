// Canonical Scene Asset URL / key contract.
//
// THREE distinct concepts — do not conflate:
//
//   1. LOGICAL assetKey (opaque, provider-neutral)
//        ↳ shape: `<category>/<id>/<version>/<filename>`
//        ↳ lives on `SceneAssetDefinition.model.assetKey` and in the
//          upload manifest. NEVER carries the `scene/` prefix.
//
//   2. PHYSICAL S3 object key
//        ↳ shape: `scene/<category>/<id>/<version>/<filename>`
//        ↳ what the upload CLI writes to `PutObject.Key`.
//        ↳ Computed via `toS3ObjectKey(assetKey)`. Only the storage layer
//          (and CloudFront origin config) knows about this.
//
//   3. Public delivery URL
//        ↳ Local dev:  `/assets/scene/<assetKey>`
//        ↳ Production: `<CDN_BASE>/scene/<assetKey>`
//        ↳ Composed via `composeSceneAssetUrl(base, assetKey)`. The
//          `scene/` prefix is added by this function in BOTH cases so
//          the base URL is always "the root of the CDN or static
//          serving directory" — never the parent of the models.
//
// Guarantees this file enforces:
//   · A logical assetKey never contains `scene/…` (rejected by
//     `assertLogicalAssetKey`).
//   · Composing a URL from a valid assetKey NEVER produces `//` or
//     `scene/scene/…` anywhere in the path.
//   · Absolute URLs, backslashes, `.` / `..` segments, and empty
//     segments are always rejected.

/** Single source of truth — the top-level prefix used for both S3 object
 *  keys and public delivery URLs. Never appears inside a logical
 *  assetKey. */
export const SCENE_ASSET_PREFIX = "scene" as const;

/** Local static base — used when NEXT_PUBLIC_SCENE_ASSET_BASE_URL is
 *  unset. The composer appends `scene/…` to this, so files live under
 *  `apps/web/public/assets/scene/<category>/<id>/<version>/…`. */
export const LOCAL_SCENE_ASSET_BASE = "/assets";

/** Thumbnails may either be structured (contain `/`) or bare filenames.
 *  Bare filenames get mounted under this sub-path so local static folders
 *  stay organized. */
export const LOCAL_THUMBNAIL_SUBDIR = "thumbnails";

/**
 * Validates and normalizes a candidate LOGICAL asset key.
 *
 * Rejections:
 *   · Non-string, empty, whitespace-only.
 *   · Absolute URLs (`scheme://…`) — the catalog must ship OPAQUE keys.
 *   · Backslashes (Windows separators leaking through).
 *   · `.` or `..` path segments (traversal defense).
 *   · Empty segments (`//`).
 *   · Leading slashes (stripped, then re-checked).
 *   · Keys that START with the `scene/` prefix — that's the physical
 *     S3 shape, not the logical shape.
 *
 * Returns the normalized key or `null` on any failure.
 */
export function normalizeAssetKey(input: string | undefined | null): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return null;
  if (raw.includes("\\")) return null;
  const stripped = raw.replace(/^\/+/, "");
  const segments = stripped.split("/");
  for (const s of segments) {
    if (s === ".." || s === ".") return null;
    if (s.length === 0) return null;
  }
  // Reject keys that carry the `scene/` prefix inline — that would
  // double-nest as `scene/scene/…` after composition.
  if (segments[0] === SCENE_ASSET_PREFIX) return null;
  return stripped;
}

/** Physical S3 object key = `scene/` + logical assetKey. Returns null
 *  when the input fails normalization. */
export function toS3ObjectKey(assetKey: string | undefined | null): string | null {
  const key = normalizeAssetKey(assetKey);
  if (!key) return null;
  return `${SCENE_ASSET_PREFIX}/${key}`;
}

/**
 * Composes a public delivery URL for a scene-asset model. Always
 * inserts the `scene/` prefix between the base URL and the assetKey.
 *
 * `baseUrl` is the ROOT of the delivery layer — never the parent folder
 * of the models. Examples:
 *   · Local dev:   "/assets"
 *   · S3 direct:   "https://<bucket>.s3.<region>.amazonaws.com"
 *   · CloudFront:  "https://<dist>.cloudfront.net"
 *   · CloudFront + custom domain: "https://assets.example.com"
 *
 * Trailing slashes on `baseUrl` are stripped.
 */
export function composeSceneAssetUrl(
  baseUrl: string,
  assetKey: string | undefined | null,
): string | null {
  const key = normalizeAssetKey(assetKey);
  if (!key) return null;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/${SCENE_ASSET_PREFIX}/${key}`;
}

/**
 * Composes a public delivery URL for a thumbnail. Structured keys
 * (contain `/`) are treated identically to model keys — the caller's
 * placement is trusted. Bare filenames are mounted under
 * `scene/<thumbnails subdir>/…`.
 */
export function composeSceneAssetThumbnailUrl(
  baseUrl: string,
  thumbnailKey: string | undefined | null,
): string | null {
  const key = normalizeAssetKey(thumbnailKey);
  if (!key) return null;
  const base = baseUrl.replace(/\/+$/, "");
  if (key.includes("/")) return `${base}/${SCENE_ASSET_PREFIX}/${key}`;
  return `${base}/${SCENE_ASSET_PREFIX}/${LOCAL_THUMBNAIL_SUBDIR}/${key}`;
}
