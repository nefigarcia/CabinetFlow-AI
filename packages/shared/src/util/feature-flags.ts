// Pure boolean parser for `NEXT_PUBLIC_FEATURE_*` env values.
//
// Kept in shared so the web feature-flag helper — and any future API-side
// gate — routes the same string-to-bool convention through one place.
// Truthy values: "true", "1". Everything else (including undefined / "") is
// treated as disabled, so unset flags default to OFF.

export function isFeatureEnabled(rawValue: string | undefined | null): boolean {
  if (rawValue === "true") return true;
  if (rawValue === "1") return true;
  return false;
}
