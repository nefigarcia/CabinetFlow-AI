import type { EffectiveProfile } from "./resolver";
import type {
  CabinetMaterialProfileFields,
  ConstructionProfileFields,
  FieldProvenanceMap,
  HardwareProfileFields,
  ProfileKind,
  ProfileSource,
} from "./types";
import { GAP_FIELD_MAP } from "./verification-gaps";

// Effective verification-gap resolver. A gap resolves when its mapped
// field has a NON-NULL value AND the winning provenance is "verified"
// (or "project_specific" under project-readiness). An `unverified`
// concrete value never closes a manufacturing verification gap.

export type GapEvaluationPurpose =
  | "shop_profile_completeness"   // Only "verified" closes a gap
  | "project_readiness";          // Also accepts "project_specific"

export interface EffectiveProfileBundle {
  construction: EffectiveProfile<ConstructionProfileFields>;
  material:     EffectiveProfile<CabinetMaterialProfileFields>;
  hardware:     EffectiveProfile<HardwareProfileFields>;
}

export interface ProfilesBySourceBundle {
  construction: Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
  material:     Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
  hardware:     Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
}

export interface GapResolutionInput {
  merged:            EffectiveProfileBundle;
  contributingRaw:   Array<{ verificationGaps: string[] | null }>;
  profilesBySource:  ProfilesBySourceBundle;
  purpose:           GapEvaluationPurpose;
}

export interface GapResolutionResult {
  open:     string[];
  resolved: string[];
}

export function effectiveVerificationGaps(input: GapResolutionInput): GapResolutionResult {
  // 1. Union raw gap keys from every contributing profile row (dedup).
  const raw = new Set<string>();
  for (const p of input.contributingRaw) {
    for (const g of p.verificationGaps ?? []) raw.add(g);
  }

  const open: string[] = [];
  const resolved: string[] = [];

  for (const gap of raw) {
    const mapping = GAP_FIELD_MAP[gap];
    // Not modelled as a persisted field → cannot resolve via field value.
    if (!mapping) {
      open.push(gap);
      continue;
    }

    const kind = mapping.kind as ProfileKind;
    const merged = input.merged[kind];
    const value = (merged.effective as Record<string, unknown>)[mapping.field];
    if (value === null || value === undefined) {
      open.push(gap);
      continue;
    }

    // Field is non-null. Check its provenance.
    const source = (merged.fieldSources as Record<string, ProfileSource | undefined>)[mapping.field];
    if (!source) {
      // Value present but resolver has no source — treat as unverified.
      open.push(gap);
      continue;
    }
    const profile = input.profilesBySource[kind][source];
    const provenance = profile?.fieldProvenance?.[mapping.field];
    const status = provenance?.status ?? "unverified";

    const closes =
      input.purpose === "shop_profile_completeness"
        ? status === "verified"
        : status === "verified" || status === "project_specific";

    if (closes) resolved.push(gap);
    else        open.push(gap);
  }

  return {
    open:     open.sort(),
    resolved: resolved.sort(),
  };
}
