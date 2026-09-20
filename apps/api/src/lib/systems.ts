// Shared helpers for the Phase 2 systems API routes.
//
// Mirrors apps/api/src/lib/profiles.ts — three-state PATCH builder,
// Prisma.DbNull conversion for LONGTEXT-Json columns, and normalized
// provenance handling. Keeps per-route files small and consistent.

import { Prisma } from "@woodcraft/db";
import {
  buildPartialPrismaUpdate,
  CABINET_FAMILY_RULE_FIELDS,
  DRAWER_SYSTEM_FIELDS,
  FRONT_SYSTEM_FIELDS,
} from "@woodcraft/shared";

// LONGTEXT-Json columns need Prisma.DbNull (not null) to store SQL NULL.
const JSON_COLUMNS = new Set(["verificationGaps", "fieldProvenance", "metadata"]);

export function convertJsonNulls(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(data)) {
    if (JSON_COLUMNS.has(key) && data[key] === null) {
      data[key] = Prisma.DbNull;
    }
  }
  return data;
}

const HEADER_FIELDS = ["name", "description"] as const;
const PROVENANCE_TAIL_FIELDS = ["verificationStatus", "verificationGaps", "sourceRef", "metadata"] as const;

// System kinds — patch-path "kind" is treated as a stale-cleanup key
// (we DO want to persist a kind change). Not part of provenance.
const SYSTEM_KIND_FIELDS: Record<"cabinet_family_rule" | "front_system" | "drawer_system", readonly string[]> = {
  cabinet_family_rule: CABINET_FAMILY_RULE_FIELDS,
  front_system:        FRONT_SYSTEM_FIELDS,
  drawer_system:       DRAWER_SYSTEM_FIELDS,
};

export type SystemKind = keyof typeof SYSTEM_KIND_FIELDS;

/** All PATCHable columns for a given system kind (excludes fieldProvenance;
 *  that's added back after stale-cleanup normalization). */
export function patchableFieldsForSystem(kind: SystemKind): readonly string[] {
  return [...HEADER_FIELDS, ...SYSTEM_KIND_FIELDS[kind], ...PROVENANCE_TAIL_FIELDS];
}

/** Adapts the Phase 1 `normalizeStaleFieldProvenance` for a system row.
 *
 *  The Phase 1 helper is keyed by ProfileKind — Phase 2 system rows share
 *  the same fieldProvenance JSON shape, so we can reuse it by treating
 *  the row like a lookalike profile kind. We rely on the fact that Phase
 *  1's canonical list is used only to determine which fields the cleanup
 *  should scan; we pass the Phase 2 field list through the same
 *  mechanism by pre-computing the cleanup ourselves. */
export function buildSystemUpdatePayload(input: {
  kind:     SystemKind;
  existing: { fieldProvenance: Record<string, unknown> | null };
  parsed:   Record<string, unknown>;
}): Record<string, unknown> {
  const scalarData = buildPartialPrismaUpdate(input.parsed, patchableFieldsForSystem(input.kind));

  const parsedForProvenance = { ...input.parsed };
  if ("fieldProvenance" in input.parsed) {
    (scalarData as Record<string, unknown>).fieldProvenance = input.parsed.fieldProvenance ?? null;
  }

  // For system rows we intentionally use the Phase 1 provenance-normalizer
  // by declaring a synthetic canonical field list matching the system
  // kind. That helper is generic over the field list via `kind` mapping,
  // so we pass its ProfileKind arg as any of the Phase 1 kinds and
  // then post-filter — but simpler: replicate the exact cleanup logic
  // inline here to avoid coupling to the Phase 1 `kind` enum.
  const canonical = SYSTEM_KIND_FIELDS[input.kind];
  const finalData = normalizeStaleFieldProvenanceForSystem({
    canonical,
    existing: input.existing,
    patch: parsedForProvenance,
    data: scalarData as { fieldProvenance?: never } & Record<string, unknown>,
  });

  return convertJsonNulls(finalData);
}

/** Same shape as Phase 1's normalizeStaleFieldProvenance but takes an
 *  explicit canonical field list. Duplicated to avoid extending the
 *  Phase 1 `ProfileKind` enum with Phase 2 kinds. */
function normalizeStaleFieldProvenanceForSystem(input: {
  canonical: readonly string[];
  existing:  { fieldProvenance: Record<string, unknown> | null };
  patch:     Record<string, unknown>;
  data:      Record<string, unknown> & { fieldProvenance?: unknown };
}): Record<string, unknown> {
  const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

  const provenanceExplicitlyPatched = hasOwn(input.patch, "fieldProvenance");
  const baseProvenance = provenanceExplicitlyPatched
    ? ((input.data.fieldProvenance as Record<string, unknown> | null) ?? null)
    : (input.existing.fieldProvenance ?? null);

  let workingMap: Record<string, unknown> | null = null;
  let changedByCleanup = false;

  if (baseProvenance) {
    for (const field of input.canonical) {
      if (!hasOwn(input.patch, field)) continue;
      if (input.patch[field] !== null) continue;
      if (!hasOwn(baseProvenance, field)) continue;
      if (!workingMap) workingMap = { ...baseProvenance };
      delete workingMap[field];
      changedByCleanup = true;
    }
  }

  if (!provenanceExplicitlyPatched && !changedByCleanup) return input.data;
  const finalMap = workingMap ?? baseProvenance;
  const normalized =
    finalMap === null
      ? null
      : Object.keys(finalMap).length === 0
        ? null
        : finalMap;

  return { ...input.data, fieldProvenance: normalized };
}

// ─── Prisma row → domain row (Decimal → number) ────────────────────────────

export function normalizeCabinetFamilyRuleRow(row: unknown): Record<string, unknown> | null {
  if (!row) return null;
  const r = row as Record<string, unknown>;
  return {
    ...r,
    toeHeightMm:    r.toeHeightMm != null ? Number(r.toeHeightMm) : null,
    toeRecessMm:    r.toeRecessMm != null ? Number(r.toeRecessMm) : null,
    topRevealMm:    r.topRevealMm != null ? Number(r.topRevealMm) : null,
    bottomRevealMm: r.bottomRevealMm != null ? Number(r.bottomRevealMm) : null,
    topScribeMm:    r.topScribeMm != null ? Number(r.topScribeMm) : null,
    bottomScribeMm: r.bottomScribeMm != null ? Number(r.bottomScribeMm) : null,
  };
}

export function normalizeDrawerSystemRow(row: unknown): Record<string, unknown> | null {
  if (!row) return null;
  const r = row as Record<string, unknown>;
  return {
    ...r,
    boxSideThicknessMm:     r.boxSideThicknessMm != null ? Number(r.boxSideThicknessMm) : null,
    boxBottomThicknessMm:   r.boxBottomThicknessMm != null ? Number(r.boxBottomThicknessMm) : null,
    boxBackThicknessMm:     r.boxBackThicknessMm != null ? Number(r.boxBackThicknessMm) : null,
    boxSubFrontThicknessMm: r.boxSubFrontThicknessMm != null ? Number(r.boxSubFrontThicknessMm) : null,
  };
}
