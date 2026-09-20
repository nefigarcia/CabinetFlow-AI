// Deep-merge + normalization for cabinetSystemAssignments blobs stored
// under {Organization,Project,Room}.metadata. Three-state semantics
// apply at every key:
//   absent (undefined)  → preserve existing value
//   null                → clear that key
//   value               → set that key
//
// After merge, if `cabinetSystemAssignments` reduces to `{}` (all
// sub-keys cleared / removed), it is normalized OUT of the metadata
// blob — never persisted as an empty object.

import type { CabinetType } from "../../types/cabinet";
import type { CabinetSystemAssignments } from "./types";

/** Patch shape used by API-side merge callers. Same tree as
 *  CabinetSystemAssignments but with `null` allowed at every leaf and
 *  at the top-level `familyRuleIdsByCabinetType` slot (three-state:
 *  absent/null/value at each level). */
export interface CabinetSystemAssignmentsPatchShape {
  familyRuleIdsByCabinetType?:
    | Partial<Record<CabinetType, string | null | undefined>>
    | null;
  preferredFrontSystemId?:  string | null;
  preferredDrawerSystemId?: string | null;
}

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const CABINET_TYPES: readonly CabinetType[] = [
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
];

/** Deep-merge patch onto existing assignments and normalize empties away.
 *
 * Semantics at the top level:
 *   patch === undefined → preserve existing (return normalized existing)
 *   patch === null      → clear the entire assignments blob
 *   patch === object    → per-key deep merge (see below)
 *
 * Semantics at each sub-key:
 *   absent (undefined) → preserve existing value
 *   null               → clear that key
 *   value              → set
 */
export function mergeCabinetSystemAssignments(
  existing: CabinetSystemAssignments | null | undefined,
  patch: CabinetSystemAssignmentsPatchShape | null | undefined,
): CabinetSystemAssignments | null {
  if (patch === undefined) return normalizeEmpty(cloneAssignments(existing));
  if (patch === null) return null;

  const base: CabinetSystemAssignments = cloneAssignments(existing) ?? {};

  // familyRuleIdsByCabinetType
  if (hasOwn(patch, "familyRuleIdsByCabinetType")) {
    const p = patch.familyRuleIdsByCabinetType;
    if (p === null) {
      // Explicit null → clear the whole map
      delete base.familyRuleIdsByCabinetType;
    } else if (p !== undefined) {
      const map: Partial<Record<CabinetType, string>> = {
        ...(base.familyRuleIdsByCabinetType as Partial<Record<CabinetType, string>> ?? {}),
      };
      for (const key of CABINET_TYPES) {
        if (!hasOwn(p, key)) continue;   // absent → preserve
        const v = p[key];
        if (v === null) {
          delete map[key];               // null → clear that key
        } else if (typeof v === "string" && v.length > 0) {
          map[key] = v;                  // value → set
        }
      }
      if (Object.keys(map).length === 0) {
        delete base.familyRuleIdsByCabinetType;
      } else {
        base.familyRuleIdsByCabinetType = map;
      }
    }
  }

  // preferredFrontSystemId
  if (hasOwn(patch, "preferredFrontSystemId")) {
    const v = patch.preferredFrontSystemId;
    if (v === null) {
      delete base.preferredFrontSystemId;
    } else if (typeof v === "string" && v.length > 0) {
      base.preferredFrontSystemId = v;
    }
  }

  // preferredDrawerSystemId
  if (hasOwn(patch, "preferredDrawerSystemId")) {
    const v = patch.preferredDrawerSystemId;
    if (v === null) {
      delete base.preferredDrawerSystemId;
    } else if (typeof v === "string" && v.length > 0) {
      base.preferredDrawerSystemId = v;
    }
  }

  return normalizeEmpty(base);
}

function cloneAssignments(
  a: CabinetSystemAssignments | null | undefined,
): CabinetSystemAssignments | null {
  if (!a) return null;
  return {
    ...(a.familyRuleIdsByCabinetType
      ? { familyRuleIdsByCabinetType: { ...a.familyRuleIdsByCabinetType } }
      : {}),
    ...(hasOwn(a, "preferredFrontSystemId") && a.preferredFrontSystemId !== undefined
      ? { preferredFrontSystemId: a.preferredFrontSystemId }
      : {}),
    ...(hasOwn(a, "preferredDrawerSystemId") && a.preferredDrawerSystemId !== undefined
      ? { preferredDrawerSystemId: a.preferredDrawerSystemId }
      : {}),
  };
}

function normalizeEmpty(a: CabinetSystemAssignments | null): CabinetSystemAssignments | null {
  if (!a) return null;
  const keys = Object.keys(a) as (keyof CabinetSystemAssignments)[];
  if (keys.length === 0) return null;
  return a;
}

// ─── Metadata-container merge ──────────────────────────────────────────────
//
// Consumers write `cabinetSystemAssignments` inside a broader metadata
// bag. This helper merges the assignment patch into the bag WITHOUT
// discarding sibling keys (e.g. Project.metadata may carry other
// feature-specific fields).

/** Merges an assignments patch into the metadata JSON of an org/project/
 *  room row. Never touches keys other than `cabinetSystemAssignments`.
 *  Returns a NEW object; never mutates `existing`. */
export function mergeMetadataAssignmentsPatch(
  existing: Record<string, unknown> | null | undefined,
  patch: CabinetSystemAssignmentsPatchShape | null | undefined,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  const existingAssignments = readAssignmentsFromMetadata(base);
  const merged = mergeCabinetSystemAssignments(existingAssignments, patch);

  if (merged === null) {
    delete base.cabinetSystemAssignments;
  } else {
    base.cabinetSystemAssignments = merged;
  }

  if (Object.keys(base).length === 0) return null;
  return base;
}

/** Safe read: parses cabinetSystemAssignments from a metadata bag,
 *  ignoring unknown keys or malformed shapes. */
export function readAssignmentsFromMetadata(
  metadata: unknown,
): CabinetSystemAssignments | null {
  if (!metadata || typeof metadata !== "object") return null;
  const csa = (metadata as Record<string, unknown>).cabinetSystemAssignments;
  if (!csa || typeof csa !== "object") return null;

  const c = csa as Record<string, unknown>;
  const out: CabinetSystemAssignments = {};

  if (c.familyRuleIdsByCabinetType && typeof c.familyRuleIdsByCabinetType === "object") {
    const m = c.familyRuleIdsByCabinetType as Record<string, unknown>;
    const map: Partial<Record<CabinetType, string>> = {};
    for (const key of CABINET_TYPES) {
      const v = m[key];
      if (typeof v === "string" && v.length > 0) map[key] = v;
    }
    if (Object.keys(map).length > 0) out.familyRuleIdsByCabinetType = map;
  }
  if (typeof c.preferredFrontSystemId === "string" && c.preferredFrontSystemId.length > 0) {
    out.preferredFrontSystemId = c.preferredFrontSystemId;
  }
  if (typeof c.preferredDrawerSystemId === "string" && c.preferredDrawerSystemId.length > 0) {
    out.preferredDrawerSystemId = c.preferredDrawerSystemId;
  }

  return Object.keys(out).length === 0 ? null : out;
}
