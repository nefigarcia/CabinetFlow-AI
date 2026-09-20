import type {
  FieldVerification,
  FieldVerificationStatus,
  FieldProvenanceMap,
  ProfileSource,
} from "./types";

// Field-level inheritance resolver. Merges profile fields across scopes
// LOW → HIGH precedence (organization → project → room → cabinet); only
// non-null / non-undefined values override inherited values. `null` at
// any scope means "inherit," never "erase inherited."

/** One scope's contribution to the merge. `profile === null` means "no
 *  profile at this scope" — distinct from "profile whose every field
 *  is null." */
export interface ScopeContribution<T> {
  source: ProfileSource;
  profile:
    | (T & { id: string; verificationStatus?: string; sourceRef?: string | null })
    | null;
}

/** Result of merging one profile kind across scopes. */
export interface EffectiveProfile<T> {
  effective: { [K in keyof T]: T[K] | null };
  profileIds: Partial<Record<ProfileSource, string>>;
  fieldSources: Partial<Record<keyof T, ProfileSource>>;
}

/**
 * Generic merger. Consumers pass the canonical field list for the kind
 * + a low-to-high-ordered list of scope contributions.
 *
 * Rule (Phase 1):
 *   For a given (kind, field) pair, the effective value is the value of
 *   that field on the HIGHEST-precedence scope whose profile is non-null
 *   AND whose field value is non-null / non-undefined. If no scope
 *   satisfies both, the field's effective value is `null`.
 */
export function mergeProfileFields<T extends object>(
  fields: readonly (keyof T & string)[],
  contributions: readonly ScopeContribution<T>[],
): EffectiveProfile<T> {
  // Seed effective with null for every canonical field. Fields the
  // profile row may carry but that are NOT in `fields` are ignored —
  // metadata / verificationStatus / sourceRef never leak into `effective`.
  const effective = Object.fromEntries(fields.map((f) => [f, null])) as {
    [K in keyof T]: T[K] | null;
  };
  const fieldSources: Partial<Record<keyof T, ProfileSource>> = {};
  const profileIds: Partial<Record<ProfileSource, string>> = {};

  for (const { source, profile } of contributions) {
    if (!profile) continue;
    profileIds[source] = profile.id;
    for (const field of fields) {
      const value = (profile as unknown as Record<string, unknown>)[field];
      if (value !== null && value !== undefined) {
        effective[field] = value as T[typeof field];
        fieldSources[field] = source;
      }
    }
  }

  return { effective, profileIds, fieldSources };
}

// ─── Per-field effective verification ──────────────────────────────────────

/**
 * Determines per-field verification for the winning scope. NEVER falls
 * back to profile-row `verificationStatus`: a `partially_verified`
 * profile-row status must not paint a verified field's display, and an
 * `unverified` profile-row status must not hide a project-specific
 * override that's legitimately set.
 *
 * Returns `{ status: "unknown" }` when no scope produced the field
 * (`fieldSources` has no entry) or when the winning profile has no
 * provenance entry for the field (SAFE DEFAULT — never optimistically
 * promote to verified without evidence).
 */
export function effectiveFieldVerification<T>(
  field: keyof T & string,
  effective: EffectiveProfile<T>,
  profilesBySource: Partial<
    Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>
  >,
): FieldVerification {
  const source = effective.fieldSources[field];
  if (!source) return { status: "unknown" };

  const profile = profilesBySource[source];
  if (!profile) return { status: "unknown" };

  const provenance = profile.fieldProvenance?.[field];
  if (!provenance) {
    return {
      status: "unverified" as FieldVerificationStatus,
      profileSource: source,
      sourceRef: null,
    };
  }

  return {
    status: provenance.status,
    profileSource: source,
    sourceRef: provenance.sourceRef ?? null,
  };
}
