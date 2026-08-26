import { z } from "zod";

/**
 * Lifecycle state controlling how a cabinet part responds to automatic
 * recomputation of its parent cabinet.
 *
 * - `generated`          — regenerated in full on every recompute.
 * - `generated_override` — originally generated; one or more properties are
 *                          intentionally overridden and must be preserved
 *                          across recomputes. Recompute may update non-
 *                          overridden fields.
 * - `manual`             — created directly by the designer. Never touched
 *                          by automatic recomputation.
 * - `locked`             — frozen against ALL automatic modification,
 *                          regardless of origin.
 */
export type PartGenerationMode =
  | "generated"
  | "generated_override"
  | "manual"
  | "locked";

export const partGenerationModeSchema: z.ZodType<PartGenerationMode> = z.enum([
  "generated",
  "generated_override",
  "manual",
  "locked",
]);

/** True when regeneration would destroy user intent for this part. */
export function isProtectedFromRegeneration(mode: PartGenerationMode): boolean {
  return mode !== "generated";
}

/** True when the part can be freely rebuilt from cabinet parameters. */
export function isFullyRegeneratable(mode: PartGenerationMode): boolean {
  return mode === "generated";
}

/** True when NO automatic modification is permitted. */
export function isFullyLocked(mode: PartGenerationMode): boolean {
  return mode === "locked";
}

// ── Legacy compatibility ─────────────────────────────────────────────────────
// The current production DB stores a single boolean `CabinetPart.isManual`.
// These functions establish the canonical mapping used by adapters so
// existing production data preserves its effective meaning.

/** `isManual=false → generated`, `isManual=true → manual`. */
export function partGenerationModeFromLegacyIsManual(
  isManual: boolean,
): PartGenerationMode {
  return isManual ? "manual" : "generated";
}

/**
 * Reverse mapping used when writing back to the legacy `isManual` column.
 * `manual` and `locked` map to `isManual=true` (both must be preserved by the
 * recompute pipeline). `generated` and `generated_override` map to
 * `isManual=false`; the override subtlety is lost by the legacy boolean and
 * must be reconstructed from the V2 domain document.
 */
export function legacyIsManualFromGenerationMode(
  mode: PartGenerationMode,
): boolean {
  return mode === "manual" || mode === "locked";
}
