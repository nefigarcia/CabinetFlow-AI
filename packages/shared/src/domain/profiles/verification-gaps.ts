import type { ProfileKind } from "./types";

// Canonical verification-gap vocabulary. Gap keys describe MISSING
// CONCEPTS, never specific customer / project names. New gap keys land
// here additively.
//
// A gap ← the concept is not YET verified.
// A gap resolves when a mapped field has a non-null value at ANY scope
// (see `effectiveVerificationGaps`).
//
// Verified-but-unmodeled facts DO NOT go in gaps — they go in
// `metadata.deferredCapabilities` (see deferred-capabilities.ts). Those
// surface under `PROFILE_CAPABILITY_DEFERRED`, distinct from gaps.

export const CANONICAL_GAP_KEYS = [
  // ── Construction (dimensional / joinery / boring) ────────────────
  "back_thickness",
  "back_attachment_method",
  "toe_kick_construction",
  "toe_kick_height",
  "face_frame_stile_width",
  "face_frame_rail_width",
  "face_frame_thickness",
  "shelf_thickness",           // Fixed shelves — separate from adjustable
  "shelf_pin_spacing",
  "fixed_vs_adjustable_shelf_rule",
  "dado_dimensions",
  "rabbet_dimensions",
  "joinery_family",
  "confirmat_screw_dowel_rule",
  "edge_banding_rule",
  "scribe_allowance",
  "reveal_gap_standard",
  "door_overlay_clearance",
  "crown_construction_detail",
  "appliance_panel_fastening",

  // ── Material policy ──────────────────────────────────────────────
  "carcass_material",
  "back_material",
  "adjustable_shelf_material",
  "nailer_material",
  "face_frame_material",
  "door_material",
  "shelf_material",             // Fixed shelves
  "drawer_box_material",

  // ── Drawer construction (typed representation deferred) ──────────
  "drawer_system",              // Whether a shop-wide system standard exists
  "drawer_system_selection_rule", // How to pick a variant per cabinet
  "adjustable_shelf_thickness",
  "nailer_thickness",

  // ── Hardware boring / setback / rules ────────────────────────────
  "hinge_system_family",
  "hinge_cup_setback",
  "hinge_plate_setback",
  "hinge_boring_pattern",
  "drawer_slide_system_family",
  "drawer_slide_length",
  "drawer_slide_setback",
  "drawer_box_clearance",
  "boring_system",
  "tool_assignment",
] as const;

export type CanonicalGapKey = (typeof CANONICAL_GAP_KEYS)[number];

// ─── Mapping: gap key → profile field that resolves it ─────────────────────

export interface GapMapping {
  kind: ProfileKind;
  field: string;
}

/** `null` means the concept is not modelled as a persisted field yet.
 *  Those gaps NEVER resolve via a field — they must be handled by a
 *  future typed domain (Phase 2/3) or by an evidence table. */
export const GAP_FIELD_MAP: Readonly<Record<string, GapMapping | null>> = {
  // ── Construction ─────────────────────────────────────────────────
  back_thickness:              { kind: "construction", field: "backThicknessMm" },
  adjustable_shelf_thickness:  { kind: "construction", field: "adjustableShelfThicknessMm" },
  nailer_thickness:            { kind: "construction", field: "nailerThicknessMm" },
  back_attachment_method:      null,
  toe_kick_construction:       null,
  toe_kick_height:             null,
  face_frame_stile_width:      null,
  face_frame_rail_width:       null,
  face_frame_thickness:        null,
  shelf_thickness:             null,
  shelf_pin_spacing:           null,
  fixed_vs_adjustable_shelf_rule: null,
  dado_dimensions:             null,
  rabbet_dimensions:           null,
  joinery_family:              null,
  confirmat_screw_dowel_rule:  null,
  edge_banding_rule:           null,
  scribe_allowance:            null,
  reveal_gap_standard:         null,
  door_overlay_clearance:      null,
  crown_construction_detail:   null,
  appliance_panel_fastening:   null,

  // ── Material ─────────────────────────────────────────────────────
  carcass_material:            { kind: "material", field: "carcassMaterialSpec" },
  back_material:               { kind: "material", field: "backMaterialSpec" },
  adjustable_shelf_material:   { kind: "material", field: "adjustableShelfMaterialSpec" },
  nailer_material:             { kind: "material", field: "nailerMaterialSpec" },
  face_frame_material:         { kind: "material", field: "faceFrameMaterialSpec" },
  door_material:               { kind: "material", field: "doorMaterialSpec" },
  shelf_material:              { kind: "material", field: "shelfMaterialSpec" },
  drawer_box_material:         { kind: "material", field: "drawerBoxMaterialSpec" },

  // ── Drawer / hardware ────────────────────────────────────────────
  drawer_system:                 null,
  drawer_system_selection_rule:  null,
  hinge_system_family:           { kind: "hardware", field: "hingeSystem" },
  drawer_slide_system_family:    { kind: "hardware", field: "drawerSlideSystem" },
  hinge_cup_setback:             null,
  hinge_plate_setback:           null,
  hinge_boring_pattern:          null,
  drawer_slide_length:           null,
  drawer_slide_setback:          null,
  drawer_box_clearance:          null,
  boring_system:                 null,
  tool_assignment:               null,
};
