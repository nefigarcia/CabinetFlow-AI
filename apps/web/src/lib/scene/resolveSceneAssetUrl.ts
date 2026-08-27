// Central URL resolver for Scene Asset artifacts.
//
// `assetKey` and `thumbnailKey` are OPAQUE identifiers on the catalog
// (see Slice 1 DECISION 4). This module is the single place they get
// resolved to a fetchable URL. Every consumer — the loader, catalog
// thumbnails, error logs — routes through here so a future swap to a
// CDN / S3 origin needs only ONE code change.
//
// For MVP the URLs point at Next.js static assets under
// `apps/web/public/assets/scene/`. When S3 lands, this file changes to
// return `${S3_CDN_URL}/scene-assets/...` — no consumer touches raw
// storage URLs directly.

/** Public base for the local static asset root. */
const LOCAL_SCENE_ASSET_BASE = "/assets/scene";

/** Public base for local thumbnails. Kept separate so we can later
 *  serve thumbnails from a different origin than models. */
const LOCAL_THUMBNAIL_BASE = "/assets/scene/thumbnails";

/**
 * Turns an opaque `assetKey` into a URL the loader can fetch. Empty /
 * whitespace / non-string input returns null so callers can cleanly
 * fall back to the primitive renderer instead of triggering a 404 GET.
 */
export function resolveSceneAssetUrl(assetKey: string | undefined | null): string | null {
  if (typeof assetKey !== "string") return null;
  const key = assetKey.trim();
  if (key.length === 0) return null;
  // A future S3 build path would compose `${S3_CDN_URL}/${key}` here.
  // The leading slash on `LOCAL_SCENE_ASSET_BASE` keeps this valid at
  // any Next.js route depth.
  return `${LOCAL_SCENE_ASSET_BASE}/${stripLeadingSlash(key)}`;
}

/** Turns an opaque `thumbnailKey` into a URL for the catalog card. */
export function resolveSceneAssetThumbnailUrl(
  thumbnailKey: string | undefined | null,
): string | null {
  if (typeof thumbnailKey !== "string") return null;
  const key = thumbnailKey.trim();
  if (key.length === 0) return null;
  return `${LOCAL_THUMBNAIL_BASE}/${stripLeadingSlash(key)}`;
}

function stripLeadingSlash(s: string): string {
  return s.startsWith("/") ? s.slice(1) : s;
}
