// Web-side feature flags.
//
// Every flag is a `NEXT_PUBLIC_FEATURE_*` env var parsed through the
// shared `isFeatureEnabled` helper so the "truthy" convention ("true" or
// "1") stays consistent across the app and the API. Next.js inlines
// `NEXT_PUBLIC_*` reads at build time, so referencing these constants is
// tree-shakeable when the flag is off.

import { isFeatureEnabled } from "@woodcraft/shared";

/**
 * Gates the Scene Asset system (Slice 2+). When disabled: no scene layer
 * mounts, no scene-asset UI appears, no dev seed control is visible.
 * The current Rooms workspace behaves exactly as before.
 */
export const SCENE_ASSETS_ENABLED = isFeatureEnabled(
  process.env.NEXT_PUBLIC_FEATURE_SCENE_ASSETS,
);
