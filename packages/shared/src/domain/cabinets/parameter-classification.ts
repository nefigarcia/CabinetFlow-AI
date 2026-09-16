// Classification of Cabinet `parameters.*` keys by whether a change to
// the key should trigger a CAD geometry recompute + parts resync on the
// API PATCH path.
//
// The problem this exists to solve:
//   The PATCH route currently treats ANY `parameters` change as
//   requiring recompute. That's correct for shelf count / drawer count
//   / door count / construction profile, and it's WRONG for wall
//   placement — moving a cabinet along a wall changes its position
//   but not its manufactured parts. Blind recompute wastes a CAD service
//   round-trip on every drag commit and, worse, races with the drag UX
//   because syncParts may not return before the next drag starts.
//
// Design:
//   · Placement-only keys (e.g. `wallPlacement`) never trigger recompute.
//   · Every OTHER known parameter key — the ones the compileUnit /
//     manufacturing math actually consumes — triggers recompute.
//   · Unknown keys default to recompute. This is the safe default: if a
//     new manufacturing-affecting parameter lands but this file isn't
//     updated, the worst case is an extra CAD call, not a missed one.
//
// Change-detection is a shallow key-level compare between the merged
// parameters and the previous parameters. That's the right granularity
// because parameter values are either primitives (numbers, strings,
// booleans) or opaque nested objects (like wallPlacement) that the
// PATCH client always replaces whole.

/** Keys that should NEVER cause a CAD recompute when they change. */
export const PLACEMENT_ONLY_PARAMETER_KEYS: readonly string[] = [
  "wallPlacement",
];

const PLACEMENT_ONLY_SET = new Set(PLACEMENT_ONLY_PARAMETER_KEYS);

/** Returns the set of top-level parameter keys whose values differ
 *  between `next` (the incoming patch) and `prev` (what's stored). Only
 *  keys present in `next` are considered — a caller that omits a key
 *  from the patch is not asking to change it. */
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

/** True when any of the changed parameter keys is manufacturing-affecting
 *  (i.e. is NOT in the placement-only allowlist). Unknown keys count as
 *  manufacturing-affecting — safe default. */
export function doesParameterChangeRequireCadRecompute(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  const changed = diffParameterKeys(prev, next);
  if (changed.length === 0) return false;
  return changed.some((k) => !PLACEMENT_ONLY_SET.has(k));
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
