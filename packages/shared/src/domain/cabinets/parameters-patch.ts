// Canonical Cabinet.parameters PATCH merger.
//
// Replaces the previous inline shallow-spread in the Cabinet PATCH
// route. Handles per-key policy so a `null` on a "deletable" key
// actually REMOVES that key from the bag (the shallow-spread bug —
// spreading `{ ... }` over `{ constructionProfileId: "abc" }` used to
// leave the old key intact when the client just wanted to clear it).
//
// Per-key policy:
//
//   For DELETABLE_KEYS:
//     absent in patch  → keep existing value
//     value in patch   → set to value
//     null  in patch   → REMOVE key from bag
//
//   For all other keys:
//     absent in patch  → keep existing value
//     value in patch   → set to value
//     null  in patch   → set to literal null (Zod on Cabinet PATCH
//                        does not admit null for these today; branch
//                        retained for defense in depth).
//
// Convention (repo-established, e.g. withCabinetWallPlacement): the
// parameter bag never stores an explicit `null` for the deletable
// keys — a cleared key is DELETED from the JSON object.

const PROFILE_REF_KEYS: readonly string[] = [
  "constructionProfileId",
  "materialProfileId",
  "hardwareProfileId",
];

// Phase 2 cabinet-level system refs. Same deletion semantics as the
// Phase 1 profile refs (null = remove key → resolver resumes normal
// inheritance).
const SYSTEM_REF_KEYS: readonly string[] = [
  "familyRuleId",
  "frontSystemId",
  "drawerSystemId",
];

const WALL_PLACEMENT_KEY = "wallPlacement";

const DELETABLE_KEYS: ReadonlySet<string> = new Set<string>([
  ...PROFILE_REF_KEYS,
  ...SYSTEM_REF_KEYS,
  WALL_PLACEMENT_KEY,
]);

// The disableFamilyRule flag has its own canonical persistence:
//   true  → stored as literal true
//   false → key REMOVED from the bag (canonical absence == "off")
//   absent from patch → preserve existing state
// It is intentionally NOT in DELETABLE_KEYS — the trigger for removal
// is `false`, not `null`.
const DISABLE_FAMILY_RULE_KEY = "disableFamilyRule";

/**
 * Apply an incoming partial `parameters` patch against the FULL
 * existing bag. Returns a fresh object; never mutates `existing`.
 *
 * This is the ONLY server-side path for applying a Cabinet parameters
 * PATCH. The prior inline shallow-spread pattern in the PATCH route is
 * replaced by a call to this helper.
 */
export function applyCabinetParametersPatch(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  if (!incoming) return base;

  for (const key of Object.keys(incoming)) {
    const value = incoming[key];
    if (key === DISABLE_FAMILY_RULE_KEY) {
      // Canonical persistence: true persists, false removes the key,
      // undefined preserves. See file header for rationale.
      if (value === true) base[key] = true;
      else if (value === false) delete base[key];
      // undefined / any other type → preserve existing state
      continue;
    }
    if (DELETABLE_KEYS.has(key) && value === null) {
      delete base[key];
    } else {
      base[key] = value;
    }
  }
  return base;
}

/** Public view of the current deletable-key policy. Exported so tests
 *  can assert what's deletable without duplicating the constant. */
export function isDeletableCabinetParameterKey(key: string): boolean {
  return DELETABLE_KEYS.has(key);
}

/** Public view of the profile-ref key list. Used by the Cabinet PATCH
 *  route to run tenancy checks on any incoming non-null profile ID. */
export const CABINET_PROFILE_REF_KEYS = PROFILE_REF_KEYS;

/** Public view of the Phase 2 system-ref key list. Used by the Cabinet
 *  PATCH route to run same-org tenancy checks on any incoming non-null
 *  system ID (familyRuleId / frontSystemId / drawerSystemId). */
export const CABINET_SYSTEM_REF_KEYS_INTERNAL = SYSTEM_REF_KEYS;
