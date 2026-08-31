export type * from "./types/api";
export type * from "./types/auth";
export type * from "./types/cabinet";
export type * from "./types/project";
export type * from "./types/geometry";
export { compileGeometry, compileUnit, repairLayout } from "./types/geometry";

// Cabinet Domain Engine V2 (additive, intent-only domain).
// See ./domain/index.ts for the full surface. This is not yet wired into
// production persistence or the geometry compiler; it exists to unblock
// downstream consumers who want to adopt the canonical design shape.
export * from "./domain";

// Cross-cutting unit-conversion helpers. Manufacturing/domain code uses
// millimeters; renderers use meters. This is the one place conversions
// should happen — do not sprinkle `/1000` across the codebase.
export * from "./util/units";

// Pure string-to-boolean parser for `NEXT_PUBLIC_FEATURE_*` env values.
// Web + API-side feature gates all route through this to keep the "truthy"
// convention consistent.
export * from "./util/feature-flags";
