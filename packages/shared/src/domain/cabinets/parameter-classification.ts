// Classification of Cabinet `parameters.*` keys by whether a change to
// the key should trigger a CAD geometry recompute + parts resync on the
// API PATCH path.
//
// Three-way classification (approved Phase 1 design):
//
//   "placement"      — affects world/wall position ONLY. No CAD recompute.
//                       Examples: wallPlacement.
//   "metadata"       — neither position nor manufacturing (today). No CAD.
//                       Examples: constructionProfileId, materialProfileId,
//                       hardwareProfileId. Reclassified to "manufacturing"
//                       when a later phase wires profiles into compileUnit.
//   "manufacturing"  — affects parts / CAD geometry. Triggers recompute.
//                       Examples: doorCount, drawerCount, shelfCount,
//                       constructionMethod, dimensions.
//
// Unknown keys default to "manufacturing" — the safe default: worst
// case is an extra CAD call, not a missed one.

export type ParameterImpact = "placement" | "metadata" | "manufacturing";

/** Canonical classification. Unknown keys default to `manufacturing`. */
export const PARAMETER_IMPACT: Readonly<Record<string, ParameterImpact>> = {
  // ── placement ────────────────────────────────────────────────────
  wallPlacement:         "placement",

  // ── metadata (Phase 1 profile refs) ──────────────────────────────
  constructionProfileId: "metadata",
  materialProfileId:     "metadata",
  hardwareProfileId:     "metadata",

  // ── metadata (Phase 2 system refs + disableFamilyRule flag) ──────
  // No CAD recompute triggered by any of these. Phase 2 is semantic /
  // readiness only.
  familyRuleId:          "metadata",
  frontSystemId:         "metadata",
  drawerSystemId:        "metadata",
  disableFamilyRule:     "metadata",

  // ── metadata (Phase 3.0 interior components) ─────────────────────
  // Semantic-only intent — never wired into compileUnit / CAD / DXF /
  // CNC / nesting / hardware BOM in Phase 3.0. PATCHes touching only
  // this key MUST NOT trigger CAD recompute. Locked in by tests.
  interiorComponents:    "metadata",

  // ── manufacturing (explicit, current) ────────────────────────────
  // Listed for discoverability; classifier defaults unknown keys to
  // manufacturing anyway.
  doorCount:             "manufacturing",
  drawerCount:           "manufacturing",
  shelfCount:            "manufacturing",
  toeKickHeight:         "manufacturing",
  doorOverlay:           "manufacturing",
  constructionMethod:    "manufacturing",
  stileWidth:            "manufacturing",
  railWidth:             "manufacturing",
  faceFrameThickness:    "manufacturing",
  blindPanelWidth:       "manufacturing",
  hingeType:             "manufacturing",
  drawerSlideType:       "manufacturing",
};

export function classifyParameterKey(key: string): ParameterImpact {
  return PARAMETER_IMPACT[key] ?? "manufacturing";
}

// ─── Legacy back-compat: `PLACEMENT_ONLY_PARAMETER_KEYS` ────────────────────
//
// The prior classifier exposed a flat allowlist. Kept as a derived
// readonly array so existing tests / consumers still resolve; the
// classifier above is now the source of truth.

export const PLACEMENT_ONLY_PARAMETER_KEYS: readonly string[] = Object.entries(
  PARAMETER_IMPACT,
)
  .filter(([, kind]) => kind === "placement")
  .map(([k]) => k);

// ─── Diff + CAD-recompute decision ──────────────────────────────────────────

/** Returns the set of top-level parameter keys whose values differ
 *  between `next` (the incoming patch OR merged final state) and
 *  `prev` (what's stored). Only keys present in `next` are considered
 *  — a caller that omits a key from the patch is not asking to change
 *  it. When passed the FINAL merged parameters (post
 *  `applyCabinetParametersPatch`), deletion of a key results in that
 *  key being absent from `next` and thus not flagged — that's fine
 *  because every deletable key today is classified as `placement` or
 *  `metadata` (no CAD impact). */
export function diffParameterKeys(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): string[] {
  if (!next) return [];
  const changed: string[] = [];
  for (const key of Object.keys(next)) {
    const prevValue = prev ? prev[key] : undefined;
    const nextValue = next[key];
    if (!shallowEqual(prevValue, nextValue)) changed.push(key);
  }
  return changed;
}

/** True when any of the changed parameter keys is classified as
 *  `manufacturing`. Unknown keys count as manufacturing — safe default.
 *  Callers should pass PREVIOUS-final vs NEXT-final parameters so
 *  deletion of a deletable-key (profile ref / wallPlacement) is
 *  correctly seen as a change but classified as placement / metadata. */
export function doesParameterChangeRequireCadRecompute(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  const changed = diffParameterKeys(prev, next);
  if (changed.length === 0) return false;
  return changed.some((k) => classifyParameterKey(k) === "manufacturing");
}

/** Shallow structural equality — good enough for the parameter bag
 *  because our parameter values are either primitives or wholly-replaced
 *  nested objects. JSON.stringify is fine here (values are always
 *  JSON-safe by construction; they came out of Prisma's JSON column). */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
