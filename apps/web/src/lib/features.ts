// Web-side feature flags.
//
// Every flag is a `NEXT_PUBLIC_FEATURE_*` env var parsed through the
// shared `isFeatureEnabled` helper so the "truthy" convention ("true" or
// "1") stays consistent across the app and the API. Next.js inlines
// `NEXT_PUBLIC_*` reads at build time, so referencing these constants is
// tree-shakeable when the flag is off.
//
// No flags are currently active — the Scene Asset flag was retired once
// the DB-backed Asset Library shipped and the feature became the
// default. New flags go here and follow the same import pattern.

import { isFeatureEnabled } from "@woodcraft/shared";

// Re-exported so future flag definitions in this file can use the same
// truthy convention without a second import.
export { isFeatureEnabled };
