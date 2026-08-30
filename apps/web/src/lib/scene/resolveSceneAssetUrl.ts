// Next.js-side wrapper around the shared Scene Asset URL resolver.
//
// Reads `NEXT_PUBLIC_SCENE_ASSET_BASE_URL` at module load (Next inlines
// NEXT_PUBLIC_* at build time), falls back to the local Next static
// path `/assets/scene/` in development. The pure composition logic +
// key normalization live in @woodcraft/shared/domain/sceneAssets so
// the resolver is fully covered by the shared unit test suite.
//
// The browser NEVER receives AWS credentials — this file only reads a
// public env var. The upload CLI (packages/asset-cli) runs server-side
// and handles the private AWS SDK path.

import {
  LOCAL_SCENE_ASSET_BASE,
  composeSceneAssetThumbnailUrl,
  composeSceneAssetUrl,
} from "@woodcraft/shared";

function readConfiguredBase(): string {
  const raw =
    (typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      process.env.NEXT_PUBLIC_SCENE_ASSET_BASE_URL) ||
    "";
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : LOCAL_SCENE_ASSET_BASE;
}

const CONFIGURED_BASE = readConfiguredBase();

/** Public accessor — makes the resolved base URL testable + debuggable. */
export function getSceneAssetBaseUrl(): string {
  return CONFIGURED_BASE;
}

/** Turns an opaque `assetKey` into a URL the loader can fetch. Returns
 *  null for missing / invalid / unsafe input. */
export function resolveSceneAssetUrl(
  assetKey: string | undefined | null,
): string | null {
  return composeSceneAssetUrl(CONFIGURED_BASE, assetKey);
}

/** Turns an opaque `thumbnailKey` into a URL for the catalog card. */
export function resolveSceneAssetThumbnailUrl(
  thumbnailKey: string | undefined | null,
): string | null {
  return composeSceneAssetThumbnailUrl(CONFIGURED_BASE, thumbnailKey);
}
