import {
  CONSTRUCTION_FIELDS,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  type FieldProvenanceMap,
  type ProfileKind,
} from "./types";

// Three-state PATCH semantics for profile writes.
//
//   patch[k] === undefined  →  skip (existing DB value untouched)
//   patch[k] === null       →  set DB column to NULL (clear override)
//   patch[k] === value      →  set DB column to value
//
// Prisma's UpdateInput type allows omitted keys; Zod .optional() gives
// undefined for absent keys and null for explicit clears. The three
// states round-trip cleanly from HTTP → Zod → Prisma.

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const CANONICAL_FIELDS: Record<ProfileKind, readonly string[]> = {
  construction: CONSTRUCTION_FIELDS as readonly string[],
  material:     MATERIAL_FIELDS     as readonly string[],
  hardware:     HARDWARE_FIELDS     as readonly string[],
};

/** Build a Prisma update payload from a Zod-parsed PATCH body. See file
 *  docstring for the three-state semantics. Explicit `undefined` values
 *  are also treated as absent (skip) — defense-in-depth against a
 *  caller who spreads a partial with `undefined` entries. */
export function buildPartialPrismaUpdate<
  K extends string,
  T extends Partial<Record<K, unknown>>,
>(
  parsed: T,
  fields: readonly K[],
): { [F in K]?: T[F] | null } {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!hasOwn(parsed, f)) continue;
    const value = (parsed as Record<string, unknown>)[f];
    if (value === undefined) continue;
    out[f] = value;
  }
  return out as { [F in K]?: T[F] | null };
}

/**
 * Normalize the fieldProvenance payload on a PATCH so no canonical
 * field ends up with a NULL value AND an active provenance entry.
 *
 * Semantic-change tracking (fixes the reference-equality bug):
 *   provenanceExplicitlyPatched — the patch body itself carries
 *     `fieldProvenance` (may be null = clear-all).
 *   changedByCleanup           — a canonical field was cleared to null
 *     AND provenance had an entry for it that we now delete.
 *
 * Only ONE of those conditions must be true to include `fieldProvenance`
 * in the outgoing Prisma update. Otherwise the outgoing `data` is
 * returned untouched — preserves the three-state contract for the map
 * itself (absent in patch ⇒ absent in Prisma update).
 *
 * The working provenance map is cloned LAZILY on first delete. No delete
 * ⇒ no clone ⇒ no object-identity noise.
 */
export function normalizeStaleFieldProvenance<
  T extends { fieldProvenance: FieldProvenanceMap | null },
>(input: {
  kind:     ProfileKind;
  existing: T;
  patch:    Partial<Record<string, unknown>>;
  data:     { fieldProvenance?: FieldProvenanceMap | null } & Record<string, unknown>;
}): typeof input.data {
  const canonical = CANONICAL_FIELDS[input.kind];

  const provenanceExplicitlyPatched = hasOwn(input.patch, "fieldProvenance");

  const baseProvenance: FieldProvenanceMap | null = provenanceExplicitlyPatched
    ? (input.data.fieldProvenance ?? null)
    : (input.existing.fieldProvenance ?? null);

  let workingMap: FieldProvenanceMap | null = null;   // lazy clone
  let changedByCleanup = false;

  if (baseProvenance) {
    for (const field of canonical) {
      if (!hasOwn(input.patch, field))     continue;   // not touched
      if (input.patch[field] !== null)     continue;   // not cleared
      if (!hasOwn(baseProvenance, field))  continue;   // no stale entry

      if (!workingMap) workingMap = { ...baseProvenance };
      delete workingMap[field];
      changedByCleanup = true;
    }
  }

  if (!provenanceExplicitlyPatched && !changedByCleanup) return input.data;

  const finalMap: FieldProvenanceMap | null = workingMap ?? baseProvenance;

  // Uniform "no provenance" representation — never persist {}.
  const normalized =
    finalMap === null
      ? null
      : Object.keys(finalMap).length === 0
        ? null
        : finalMap;

  return { ...input.data, fieldProvenance: normalized };
}
