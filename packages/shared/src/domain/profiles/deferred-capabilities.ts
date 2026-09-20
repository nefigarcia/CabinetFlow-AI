import { z } from "zod";
import type { ProfileKind, ProfileSource } from "./types";

// Verified-but-unmodeled facts. The shop KNOWS these values (evidenced
// in build sheets / shop packets), but the typed domain isn't built
// yet to represent them structurally.
//
// Contrast:
//   canonical profile field       = VERIFIED + MODELED
//   metadata.deferredCapabilities = VERIFIED + UNMODELED  ← this file
//   verificationGaps              = UNVERIFIED
//
// Surfaced under PROFILE_CAPABILITY_DEFERRED (non-blocking warning),
// distinct from PROFILE_UNVERIFIED_* (also non-blocking warning).

/** Canonical capability names for Phase 1. Additive vocabulary — new
 *  capabilities land here as evidence justifies. Centralizing the list
 *  lets the admin UI render human-readable labels + tests catch typos
 *  in seeds. */
export const DEFERRED_CAPABILITIES = [
  "typed_drawer_construction",   // Traditional drawer sub-part thicknesses
  "typed_drawer_system",         // Proprietary systems (Legrabox, Movento, …)
] as const;
export type DeferredCapabilityName = (typeof DEFERRED_CAPABILITIES)[number];

export const DEFERRED_CAPABILITY_STATUSES = ["verified_but_unmodeled"] as const;
export type DeferredCapabilityStatus = (typeof DEFERRED_CAPABILITY_STATUSES)[number];

export interface DeferredCapability {
  capability: string;   // Loose at schema (forward-compat); strict variant in tests
  status:     DeferredCapabilityStatus;
  sourceRef:  string;
  value?:     string | number | boolean | null;
  facts?:     Record<string, unknown>;
  notes?:     string;
}

export const deferredCapabilitySchema: z.ZodType<DeferredCapability> = z.object({
  capability: z.string().min(1).max(80),
  status:     z.enum(DEFERRED_CAPABILITY_STATUSES),
  sourceRef:  z.string().max(200),
  value:      z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  facts:      z.record(z.unknown()).optional(),
  notes:      z.string().max(2000).optional(),
});

export const deferredCapabilitiesArraySchema = z
  .array(deferredCapabilitySchema)
  .max(50);

/** Strict variant — rejects unknown capability names. Seeds + fixtures only. */
export function makeStrictDeferredCapabilitiesSchema(
  allowedNames: readonly string[],
): z.ZodType<DeferredCapability[]> {
  const allowed = new Set(allowedNames);
  return deferredCapabilitiesArraySchema.superRefine((arr, ctx) => {
    for (let i = 0; i < arr.length; i++) {
      if (!allowed.has(arr[i]!.capability)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown capability '${arr[i]!.capability}'`,
          path: [i, "capability"],
        });
      }
    }
  });
}

/**
 * Safe accessor. Metadata is loose JSON; this narrows it without
 * throwing. Non-matching data returns [] — fail-closed per the
 * approved Phase 1 contract. A future improvement (out of scope for
 * Phase 1) is to parse entries individually so one malformed entry
 * doesn't suppress the rest.
 */
export function readDeferredCapabilities(
  metadata: Record<string, unknown> | null | undefined,
): DeferredCapability[] {
  if (!metadata) return [];
  const raw = metadata["deferredCapabilities"];
  const parsed = deferredCapabilitiesArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

// ─── Effective set across scopes (no merging — preserves attribution) ──────

export interface DeferredCapabilityContribution {
  scope:    ProfileSource;
  kind:     ProfileKind;
  metadata: Record<string, unknown> | null | undefined;
}

export interface EffectiveDeferredCapability {
  scope:      ProfileSource;
  kind:       ProfileKind;
  capability: DeferredCapability;
}

export function effectiveDeferredCapabilities(input: {
  contributions: readonly DeferredCapabilityContribution[];
}): EffectiveDeferredCapability[] {
  const out: EffectiveDeferredCapability[] = [];
  for (const c of input.contributions) {
    for (const cap of readDeferredCapabilities(c.metadata)) {
      out.push({ scope: c.scope, kind: c.kind, capability: cap });
    }
  }
  return out;
}
