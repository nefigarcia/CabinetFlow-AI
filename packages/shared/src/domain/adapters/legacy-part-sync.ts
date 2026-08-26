// Legacy part-sync invariants (V2.1A.1).
//
// `apps/api/src/lib/parts.ts::syncParts()` is called every time a cabinet
// is created or its dimensions change. It deletes existing parts and
// creates new ones from the cad-service response.
//
// The V2.1A parity audit initially flagged this path as unsafe for manual
// parts. A closer read (V2.1A.1) confirmed that the DELETE clause already
// filters `isManual: false`, so LEGACY manual parts (isManual === true)
// have always been preserved. This module captures that invariant as a
// shared, testable constant so an accidental broadening of the filter
// surfaces in code review AND in unit tests.
//
// When V2 PartGenerationMode persistence lands (V2.5), this filter should
// be broadened to `NOT IN ('manual', 'locked', 'generated_override')`.
// Until then, `generated_override` and `locked` states MUST NOT be
// persisted — see the V2.1A persistence-risk report.

/**
 * Prisma-compatible where fragment used by `syncParts` to select which
 * CabinetPart rows are eligible for regeneration.
 *
 * INVARIANT: this MUST always constrain to `isManual: false`. Removing
 * that constraint will delete every user-created custom part on the next
 * cabinet dimension edit.
 */
export const LEGACY_PARTS_REGENERATION_FILTER = {
  isManual: false,
} as const;

/**
 * Type-level regression check. If `LEGACY_PARTS_REGENERATION_FILTER` is
 * ever changed to a shape that does NOT constrain `isManual: false`, this
 * type assignment fails at compile time.
 */
type _LegacyFilterInvariant =
  typeof LEGACY_PARTS_REGENERATION_FILTER extends { isManual: false }
    ? true
    : never;
const _legacyFilterInvariantCheck: _LegacyFilterInvariant = true;
void _legacyFilterInvariantCheck;
