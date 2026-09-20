// Shared helpers for profile CRUD routes. Keeps the per-kind route
// files small (list + create for /api/profiles/{kind}, GET/PATCH/DELETE
// for /api/profiles/{kind}/[id]).

import { Prisma } from "@woodcraft/db";
import {
  buildPartialPrismaUpdate,
  normalizeStaleFieldProvenance,
  type ProfileKind,
} from "@woodcraft/shared";

// JSON columns in Prisma need `Prisma.DbNull` (not `null`) to store SQL
// NULL. Same convention every other Json PATCH route in this API uses.
const JSON_COLUMNS = new Set(["verificationGaps", "fieldProvenance", "metadata"]);

/** Converts JS `null` → `Prisma.DbNull` for JSON columns, in place. */
export function convertJsonNulls(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(data)) {
    if (JSON_COLUMNS.has(key) && data[key] === null) {
      data[key] = Prisma.DbNull;
    }
  }
  return data;
}

// Field lists per kind — Prisma columns that carry non-JSON scalar
// values. Excluded: id, orgId, name, description, verificationStatus,
// verificationGaps, sourceRef, fieldProvenance, metadata, createdAt,
// updatedAt (handled separately or auto).

const CONSTRUCTION_SCALAR_FIELDS = [
  "constructionMethod",
  "frontOverlayMode",
  "carcassThicknessMm",
  "drawerBoxThicknessMm",
  "drawerBoxJoinery",
  "backThicknessMm",
  "adjustableShelfThicknessMm",
  "nailerThicknessMm",
] as const;

const MATERIAL_SCALAR_FIELDS = [
  "carcassMaterialSpec",
  "drawerBoxMaterialSpec",
  "faceFrameMaterialSpec",
  "doorMaterialSpec",
  "shelfMaterialSpec",
  "backMaterialSpec",
  "adjustableShelfMaterialSpec",
  "nailerMaterialSpec",
] as const;

const HARDWARE_SCALAR_FIELDS = [
  "hingeManufacturer",
  "hingeSoftClose",
  "hingeSystem",
  "drawerSlideManufacturer",
  "drawerSlideSoftClose",
  "drawerSlideSystem",
] as const;

const HEADER_FIELDS = ["name", "description"] as const;
const PROVENANCE_FIELDS = ["verificationStatus", "verificationGaps", "sourceRef", "metadata"] as const;

export const PROFILE_KIND_SCALAR_FIELDS: Record<ProfileKind, readonly string[]> = {
  construction: CONSTRUCTION_SCALAR_FIELDS,
  material:     MATERIAL_SCALAR_FIELDS,
  hardware:     HARDWARE_SCALAR_FIELDS,
};

/** All PATCHable columns (excludes fieldProvenance which needs stale-
 *  cleanup normalization). */
export function patchableFieldsForKind(kind: ProfileKind): readonly string[] {
  return [
    ...HEADER_FIELDS,
    ...PROFILE_KIND_SCALAR_FIELDS[kind],
    ...PROVENANCE_FIELDS,
  ];
}

/** Build a normalized Prisma update payload from a Zod-parsed body.
 *  Combines three-state field build + fieldProvenance stale-cleanup so
 *  every profile PATCH route uses the same pipeline. */
export function buildProfileUpdatePayload(input: {
  kind:     ProfileKind;
  existing: { fieldProvenance: Record<string, unknown> | null };
  parsed:   Record<string, unknown>;
}): Record<string, unknown> {
  // Build the scalar / header / provenance-field portion.
  const scalarData = buildPartialPrismaUpdate(input.parsed, patchableFieldsForKind(input.kind));

  // Provenance normalization sees the whole patch. If the caller sent
  // `fieldProvenance` in the body, buildPartialPrismaUpdate emitted it
  // above (unless it was undefined). normalizeStaleFieldProvenance will
  // strip any entries for canonical fields that the caller cleared to
  // null in this same PATCH.
  const parsedForProvenance = { ...input.parsed };
  if ("fieldProvenance" in input.parsed) {
    (scalarData as Record<string, unknown>).fieldProvenance =
      input.parsed.fieldProvenance ?? null;
  }
  const finalData = normalizeStaleFieldProvenance({
    kind: input.kind,
    existing: {
      fieldProvenance: (input.existing.fieldProvenance ?? null) as never,
    },
    patch: parsedForProvenance,
    data: scalarData as { fieldProvenance?: never } & Record<string, unknown>,
  });

  return convertJsonNulls(finalData);
}
