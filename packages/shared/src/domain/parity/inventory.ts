// Geometry Assumption Inventory (V2.1A).
//
// One entry per constant/default that affects physical cabinet geometry. Both
// the TypeScript and Python current-production values are recorded verbatim
// (NOT normalized). Neither side is preferred; downstream diff logic will
// surface every difference for engineering review against verified real
// shop measurements in V2.1B.
//
// Source references use file:line addresses captured on the V2.1A audit date.
// If either side is refactored, the audit script (packages/shared/src/domain/
// parity/__tests__/inventory.test.ts) will detect the entry is stale by
// comparing the recorded values against a fresh code read where possible.
//
// This file is HAND-AUTHORED and is the SOURCE OF TRUTH for both diff-engine
// tolerance checks and the Python parity helper's structural expectations.
// Do NOT edit values here to "fix" a mismatch — the fix belongs in the
// implementation code AND then in this file.

export type ParityStatus = "match" | "different" | "ts-only" | "python-only";

export type ParityUnit =
  | "mm"
  | "in"
  | "ratio"
  | "qty"
  | "degrees"
  | "mm_or_derived"
  | "boolean"
  | "enum";

export interface InventoryEntry {
  /** Stable machine-readable identifier. */
  key: string;
  /** Human-readable concept name. */
  concept: string;
  /** Physical category the value belongs to. */
  category: InventoryCategory;
  /** Cabinet types this value applies to; "all" is a wildcard. */
  applies: readonly (CabinetTypeScope | "all")[];
  unit: ParityUnit;

  typescriptValue: number | string | boolean | null;
  pythonValue: number | string | boolean | null;

  /** File:line reference — for tracing back to the source. */
  typescriptSource: SourceRef | null;
  pythonSource: SourceRef | null;

  status: ParityStatus;

  /** Optional condition under which the value applies. */
  condition?: string;
  /** Optional engineer note explaining why the divergence exists (or is intentional). */
  note?: string;
  /** Whether this concept has direct manufacturing impact. */
  manufacturingImpact: "high" | "medium" | "low" | "none";
}

export type CabinetTypeScope =
  | "base"
  | "wall"
  | "tall"
  | "corner"
  | "island"
  | "sink_base"
  | "drawer_base"
  | "open_shelf";

export type InventoryCategory =
  | "carcass_thickness"
  | "back_panel"
  | "toe_kick"
  | "door_front"
  | "reveals"
  | "drawer_box"
  | "drawer_slide"
  | "drawer_layout"
  | "shelf"
  | "shelf_pin"
  | "face_frame"
  | "hinge"
  | "dado_joinery"
  | "countertop"
  | "handle"
  | "corner_blind"
  | "sink_support"
  | "unit_conversion"
  | "tolerance"
  | "nesting_sheet";

export interface SourceRef {
  /** Repo-relative path. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** URL fragment for the IDE/host to jump to. */
  href: string;
}

function tsRef(file: string, line: number): SourceRef {
  return { file, line, href: `${file}#L${line}` };
}
function pyRef(file: string, line: number): SourceRef {
  return { file, line, href: `${file}#L${line}` };
}

const TS_GEOM = "packages/shared/src/types/geometry.ts";
const PY_GEOM = "services/cad-service/app/services/geometry.py";
const PY_PARAM = "services/cad-service/app/services/parametric.py";
const PY_CAB_MODEL = "services/cad-service/app/models/cabinet.py";
const PY_NEST = "services/cad-service/app/services/nesting.py";

// ── Inventory ────────────────────────────────────────────────────────────────
// Grouped by category. Values captured on the V2.1A audit; see
// STEP 1 audit report and the V2.1A Python audit for provenance.

export const GEOMETRY_ASSUMPTION_INVENTORY: readonly InventoryEntry[] = [
  // Carcass thickness ────────────────────────────────────────────────────────
  {
    key: "panel_thickness_default",
    concept: "Default panel thickness (left/right/top/bottom carcass)",
    category: "carcass_thickness",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 19,
    pythonValue: 18,
    typescriptSource: tsRef(TS_GEOM, 160),
    pythonSource: pyRef(PY_CAB_MODEL, 12),
    status: "different",
    condition: "when material_thickness parameter not supplied",
    manufacturingImpact: "high",
    note: "TS uses 19 mm (3/4\" nominal) for open-shelf carcass; Python uses 18 mm as the CabinetGeometryRequest default. This 1 mm delta compounds across every panel cut.",
  },
  // Back panel ──────────────────────────────────────────────────────────────
  {
    key: "back_panel_thickness",
    concept: "Back panel thickness",
    category: "back_panel",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 6,
    typescriptSource: null,
    pythonSource: pyRef(PY_GEOM, 66),
    status: "python-only",
    manufacturingImpact: "medium",
    note: "TS geometry compiler has no back-panel concept for closed cabinets (only open-shelf uses PANEL_T_MM for a full-cover back). Python hardcodes 6 mm HDF everywhere.",
  },
  {
    key: "back_panel_thickness_open_shelf",
    concept: "Back panel thickness (open shelf role only)",
    category: "back_panel",
    applies: ["open_shelf"],
    unit: "mm",
    typescriptValue: 19,
    pythonValue: 6,
    typescriptSource: tsRef(TS_GEOM, 160),
    pythonSource: pyRef(PY_GEOM, 66),
    status: "different",
    manufacturingImpact: "high",
    note: "TS renders open-shelf back panels at full panel thickness (19 mm); Python would use 6 mm HDF. Visible mismatch in the 3D preview vs. the cut list.",
  },
  // Toe kick ────────────────────────────────────────────────────────────────
  {
    key: "toe_kick_height",
    concept: "Toe kick height (base cabinets)",
    category: "toe_kick",
    applies: ["base", "drawer_base", "sink_base", "island", "tall"],
    unit: "mm",
    typescriptValue: 89,
    pythonValue: 96,
    typescriptSource: tsRef(TS_GEOM, 152),
    pythonSource: pyRef(PY_PARAM, 168),
    status: "different",
    condition: "when toeKickHeight parameter not supplied",
    manufacturingImpact: "high",
    note: "TS: 89 mm (3.5\"). Python: 96 mm. 7 mm delta shifts every door bottom and every drawer face position.",
  },
  {
    key: "toe_kick_depth",
    concept: "Toe kick depth (setback from front)",
    category: "toe_kick",
    applies: ["base", "drawer_base", "sink_base", "island", "tall"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: null,
    typescriptSource: null,
    pythonSource: null,
    status: "match",
    manufacturingImpact: "medium",
    note: "Neither implementation carries an explicit toe-kick depth constant; both derive from cabinet depth minus a setback that is not modeled. Flag for V2.1B — need shop-verified value.",
  },
  // Door / drawer front ─────────────────────────────────────────────────────
  {
    key: "door_thickness",
    concept: "Door / drawer front slab thickness",
    category: "door_front",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 19,
    pythonValue: 18,
    typescriptSource: tsRef(TS_GEOM, 153),
    pythonSource: pyRef(PY_CAB_MODEL, 12),
    status: "different",
    manufacturingImpact: "high",
    note: "TS DOOR_T_MM=19. Python uses material_thickness default 18. Visible in the 3D preview.",
  },
  {
    key: "door_overlay",
    concept: "Door overlay onto opening",
    category: "door_front",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 3.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 169),
    status: "python-only",
    manufacturingImpact: "high",
    note: "TS relies on PGAP_MM=2 reveals to imply overlay; Python explicitly models a 3 mm overlay onto the carcass opening. Not directly comparable.",
  },
  // Reveals ─────────────────────────────────────────────────────────────────
  {
    key: "reveal_between_fronts",
    concept: "Gap/reveal between adjacent front panels",
    category: "reveals",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 2,
    pythonValue: 2.0,
    typescriptSource: tsRef(TS_GEOM, 156),
    pythonSource: pyRef(PY_GEOM, 19),
    status: "match",
    manufacturingImpact: "medium",
    note: "Both sides agree on 2 mm gap. Do NOT change without verifying against shop practice.",
  },
  // Drawer box ──────────────────────────────────────────────────────────────
  {
    key: "drawer_box_side_thickness",
    concept: "Drawer box left/right/back panel thickness",
    category: "drawer_box",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 16,
    typescriptSource: null,
    pythonSource: pyRef(PY_GEOM, 20),
    status: "python-only",
    manufacturingImpact: "high",
    note: "TS compiler does not model drawer box structure. Python: 16 mm sides.",
  },
  {
    key: "drawer_box_bottom_thickness",
    concept: "Drawer box bottom panel thickness",
    category: "drawer_box",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 6,
    typescriptSource: null,
    pythonSource: pyRef(PY_GEOM, 21),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "drawer_box_max_height",
    concept: "Maximum drawer box height",
    category: "drawer_box",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 210,
    pythonValue: 180,
    typescriptSource: tsRef(TS_GEOM, 222),
    pythonSource: pyRef(PY_GEOM, 133),
    status: "different",
    condition: "mixed layout (drawers above doors)",
    manufacturingImpact: "medium",
    note: "TS caps individual drawer front height at 210 mm in mixed layouts; Python caps drawer BOX height at 180 mm. Two different measurements; needs shop clarification.",
  },
  // Drawer slide ────────────────────────────────────────────────────────────
  {
    key: "drawer_slide_side_clearance",
    concept: "Total side clearance for drawer slide hardware",
    category: "drawer_slide",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 26,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 140),
    status: "python-only",
    manufacturingImpact: "high",
    note: "Python: 13 mm each side (26 mm total). TS does not model.",
  },
  {
    key: "drawer_slide_clearance_behind",
    concept: "Clearance behind drawer box for slide mounting",
    category: "drawer_slide",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 30,
    typescriptSource: null,
    pythonSource: pyRef(PY_GEOM, 22),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "drawer_slide_length_increment",
    concept: "Drawer slide length increment (round to)",
    category: "drawer_slide",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 50,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 83),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  {
    key: "drawer_slide_length_factor",
    concept: "Drawer slide length as fraction of interior depth",
    category: "drawer_slide",
    applies: ["all"],
    unit: "ratio",
    typescriptValue: null,
    pythonValue: 0.75,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 83),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  // Drawer layout ratios ────────────────────────────────────────────────────
  {
    key: "drawer_zone_ratio_base",
    concept: "Mixed-layout drawer zone as fraction of interior height (base)",
    category: "drawer_layout",
    applies: ["base"],
    unit: "ratio",
    typescriptValue: 0.45,
    pythonValue: 0.38,
    typescriptSource: tsRef(TS_GEOM, 222),
    pythonSource: pyRef(PY_GEOM, 176),
    status: "different",
    manufacturingImpact: "medium",
    note: "TS uses 45% for mixed layout; Python uses 38%. Different mixed-layout heights.",
  },
  // Shelf ────────────────────────────────────────────────────────────────────
  {
    key: "shelf_thickness",
    concept: "Shelf thickness",
    category: "shelf",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 19,
    pythonValue: 18,
    typescriptSource: tsRef(TS_GEOM, 160),
    pythonSource: pyRef(PY_CAB_MODEL, 12),
    status: "different",
    manufacturingImpact: "high",
    note: "Follows carcass panel thickness on both sides.",
  },
  {
    key: "shelf_front_setback",
    concept: "Shelf inset from front edge",
    category: "shelf",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 0.5,
    typescriptSource: null,
    pythonSource: pyRef(PY_GEOM, 87),
    status: "python-only",
    manufacturingImpact: "low",
  },
  // Shelf pin ───────────────────────────────────────────────────────────────
  {
    key: "shelf_pin_spacing",
    concept: "Shelf pin vertical spacing",
    category: "shelf_pin",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 32.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 53),
    status: "python-only",
    manufacturingImpact: "medium",
    note: "Python: 32 mm system line boring. TS does not model shelf pin patterns.",
  },
  {
    key: "shelf_pin_row_inset",
    concept: "Shelf pin row inset from front edge",
    category: "shelf_pin",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 37.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 53),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  {
    key: "shelf_pin_diameter",
    concept: "Shelf pin boring diameter",
    category: "shelf_pin",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 5,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 206),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  // Face frame ──────────────────────────────────────────────────────────────
  {
    key: "face_frame_stile_width",
    concept: "Face-frame stile (vertical) width",
    category: "face_frame",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 38,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 171),
    status: "python-only",
    manufacturingImpact: "high",
    note: "TS never models face frames. Python: 38 mm stile, 38 mm rail, 19 mm thickness.",
  },
  {
    key: "face_frame_rail_width",
    concept: "Face-frame rail (horizontal) width",
    category: "face_frame",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 38,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 172),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "face_frame_thickness",
    concept: "Face-frame thickness",
    category: "face_frame",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 19,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 173),
    status: "python-only",
    manufacturingImpact: "high",
  },
  // Hinge boring ────────────────────────────────────────────────────────────
  {
    key: "hinge_cup_diameter",
    concept: "Hinge cup boring diameter",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 35,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 74),
    status: "python-only",
    manufacturingImpact: "high",
    note: "Standard Euro 35 mm cup. Python-only; TS never emits boring.",
  },
  {
    key: "hinge_cup_depth",
    concept: "Hinge cup boring depth",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 13.5,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 75),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "hinge_plate_inset",
    concept: "Hinge plate inset from door edge",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 3.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 76),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "hinge_inset_top",
    concept: "Distance from door top to top hinge cup",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 100.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 65),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "hinge_inset_bottom",
    concept: "Distance from door bottom to bottom hinge cup",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 100.0,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 65),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "hinge_extra_spacing",
    concept: "Additional-hinge vertical spacing (beyond 2-hinge)",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 150,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 67),
    status: "python-only",
    manufacturingImpact: "high",
  },
  {
    key: "hinge_count_threshold",
    concept: "Door height at which an additional hinge is required",
    category: "hinge",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 500,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 63),
    status: "python-only",
    manufacturingImpact: "high",
  },
  // Dado / joinery ──────────────────────────────────────────────────────────
  {
    key: "dado_depth_back_panel",
    concept: "Back panel dado depth",
    category: "dado_joinery",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 9,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 179),
    status: "python-only",
    condition: "clamped at min(9.0, t*0.5)",
    manufacturingImpact: "high",
  },
  // Countertop ──────────────────────────────────────────────────────────────
  {
    key: "countertop_thickness",
    concept: "Countertop slab thickness",
    category: "countertop",
    applies: ["base", "sink_base", "island"],
    unit: "mm",
    typescriptValue: 38,
    pythonValue: null,
    typescriptSource: tsRef(TS_GEOM, 157),
    pythonSource: null,
    status: "ts-only",
    manufacturingImpact: "medium",
    note: "Kitchen height only. Python cad-service does not model countertops.",
  },
  {
    key: "countertop_front_overhang",
    concept: "Countertop front overhang (non-island)",
    category: "countertop",
    applies: ["base", "sink_base"],
    unit: "mm",
    typescriptValue: 19,
    pythonValue: null,
    typescriptSource: tsRef(TS_GEOM, 158),
    pythonSource: null,
    status: "ts-only",
    manufacturingImpact: "low",
  },
  {
    key: "countertop_island_overhang",
    concept: "Countertop all-sides overhang (island)",
    category: "countertop",
    applies: ["island"],
    unit: "mm",
    typescriptValue: 38,
    pythonValue: null,
    typescriptSource: tsRef(TS_GEOM, 159),
    pythonSource: null,
    status: "ts-only",
    manufacturingImpact: "low",
  },
  // Handle ──────────────────────────────────────────────────────────────────
  {
    key: "handle_length",
    concept: "Handle bar length",
    category: "handle",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 96,
    pythonValue: null,
    typescriptSource: tsRef(TS_GEOM, 154),
    pythonSource: null,
    status: "ts-only",
    manufacturingImpact: "low",
    note: "Visual only. Python does not model handles.",
  },
  {
    key: "handle_edge_inset",
    concept: "Handle inset from door pull-side edge",
    category: "handle",
    applies: ["all"],
    unit: "mm",
    typescriptValue: 35,
    pythonValue: null,
    typescriptSource: tsRef(TS_GEOM, 155),
    pythonSource: null,
    status: "ts-only",
    manufacturingImpact: "low",
  },
  // Corner blind ────────────────────────────────────────────────────────────
  {
    key: "corner_blind_panel_ratio",
    concept: "Corner cabinet blind pocket width as fraction of cabinet width",
    category: "corner_blind",
    applies: ["corner"],
    unit: "ratio",
    typescriptValue: null,
    pythonValue: 0.4,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 373),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  // Sink support ────────────────────────────────────────────────────────────
  {
    key: "sink_stretcher_height",
    concept: "Sink base support stretcher height",
    category: "sink_support",
    applies: ["sink_base"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 89,
    typescriptSource: null,
    pythonSource: pyRef(PY_PARAM, 500),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  // Nesting ─────────────────────────────────────────────────────────────────
  {
    key: "sheet_width_default",
    concept: "Default nesting sheet width",
    category: "nesting_sheet",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 1220,
    typescriptSource: null,
    pythonSource: pyRef(PY_NEST, 69),
    status: "python-only",
    manufacturingImpact: "medium",
    note: "4x8 sheet. TS does not perform nesting.",
  },
  {
    key: "sheet_height_default",
    concept: "Default nesting sheet height",
    category: "nesting_sheet",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 2440,
    typescriptSource: null,
    pythonSource: pyRef(PY_NEST, 70),
    status: "python-only",
    manufacturingImpact: "medium",
  },
  {
    key: "nesting_kerf",
    concept: "Saw blade kerf allowance for nesting",
    category: "nesting_sheet",
    applies: ["all"],
    unit: "mm",
    typescriptValue: null,
    pythonValue: 3.2,
    typescriptSource: null,
    pythonSource: pyRef(PY_NEST, 71),
    status: "python-only",
    manufacturingImpact: "high",
  },
];

// ── Convenience lookups ─────────────────────────────────────────────────────

export function findEntry(key: string): InventoryEntry | undefined {
  return GEOMETRY_ASSUMPTION_INVENTORY.find((e) => e.key === key);
}

export function entriesByStatus(status: ParityStatus): InventoryEntry[] {
  return GEOMETRY_ASSUMPTION_INVENTORY.filter((e) => e.status === status);
}

export function entriesByCategory(category: InventoryCategory): InventoryEntry[] {
  return GEOMETRY_ASSUMPTION_INVENTORY.filter((e) => e.category === category);
}

export function inventoryStatusCounts(): Record<ParityStatus, number> {
  const out: Record<ParityStatus, number> = {
    match: 0,
    different: 0,
    "ts-only": 0,
    "python-only": 0,
  };
  for (const e of GEOMETRY_ASSUMPTION_INVENTORY) out[e.status] += 1;
  return out;
}

/**
 * Convenience getter for the TS-side value if numeric. Non-numeric or
 * missing values return undefined so callers can decide whether that is
 * a "TS does not model this concept" fact or a data hole.
 */
export function tsNumericValue(key: string): number | undefined {
  const entry = findEntry(key);
  if (!entry) return undefined;
  return typeof entry.typescriptValue === "number" ? entry.typescriptValue : undefined;
}

export function pyNumericValue(key: string): number | undefined {
  const entry = findEntry(key);
  if (!entry) return undefined;
  return typeof entry.pythonValue === "number" ? entry.pythonValue : undefined;
}
