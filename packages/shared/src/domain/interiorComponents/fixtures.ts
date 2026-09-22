// Phase 3.0 evidence-based fixtures.
//
// STRICT provenance rule (per §B and correction §5): every value here
// is either present in the referenced source document or omitted. No
// fabricated quantities. No manufactured target indices. Unknown = unset.
//
// sourceRef precision:
//   · If the exact PDF page is known and stable, cite it.
//     e.g. "Bibb Cabinetry Layouts 8_24_26 x2.pdf — PDF page 2".
//   · If page number is uncertain, cite the document + the exact
//     quoted feature string from the source. Do NOT guess a page.
//
// IDs are placeholders — real-world usage generates via
// `newInteriorComponentId()` at add time. Tests can assert the fixture
// PARSES successfully and matches expected component shapes.

import type { CabinetInteriorComponent } from "./types";

const BIBB_SOURCE = "Bibb Cabinetry Layouts 8_24_26 x2.pdf";
const KLINT_SOURCE = "Klint Anderson Build Sheets 09/04/26";

// Per correction §5, Fixture A's evidence is on Bibb page 2.
const BIBB_PAGE_2 = `${BIBB_SOURCE} — PDF page 2`;
// Page numbers for Fixture B (island/sink) and Fixture C (pullout) are
// uncertain from the available audit context — cite the document + the
// exact quoted feature line the source uses rather than guessing.
function bibbQuote(feature: string): string {
  return `${BIBB_SOURCE} — "${feature}"`;
}
function klintQuote(feature: string): string {
  return `${KLINT_SOURCE} — "${feature}"`;
}

// ─── Fixture A — Bibb spice / knife cabinet ─────────────────────────
//
// Evidence: spice rack inside, knife storage, hidden drawer inside,
// removable dividers, utensil dividers. Quantities and drawer indices
// are NOT evidenced in the source, so all targets are omitted.

export const BIBB_FIXTURE_A: CabinetInteriorComponent[] = [
  {
    id: "fixture-a-spice",
    type: "spice_rack",
    enabled: true,
    location: "interior",
    sourceRef: BIBB_PAGE_2,
    verificationStatus: "verified",
  },
  {
    id: "fixture-a-knife",
    type: "knife_organizer",
    enabled: true,
    sourceRef: BIBB_PAGE_2,
    verificationStatus: "verified",
    // No target: source does not specify which drawer.
  },
  {
    id: "fixture-a-hidden",
    type: "hidden_drawer",
    enabled: true,
    location: "inside_cabinet",
    sourceRef: BIBB_PAGE_2,
    verificationStatus: "verified",
  },
  {
    id: "fixture-a-dividers-removable",
    type: "drawer_divider",
    enabled: true,
    removable: true,
    sourceRef: BIBB_PAGE_2,
    verificationStatus: "verified",
    // No target index — source lists "Removable dividers" generically.
  },
  {
    id: "fixture-a-utensil",
    type: "utensil_divider",
    enabled: true,
    sourceRef: BIBB_PAGE_2,
    verificationStatus: "verified",
  },
];

// ─── Fixture B — Bibb island sink+trash section ─────────────────────
//
// Evidence: DBL 35 Qt Trash (bins=2, size=35qt, config=double —
// explicit), baking trays (tray_divider — no count), hidden small
// drawer above trash (hidden_drawer, location=above_trash), sink
// cabinet + sponge tilt-out + under-sink pullout. These belong to
// TWO cabinets — sink_base and island — kept as separate arrays.

export const BIBB_FIXTURE_B_SINK: CabinetInteriorComponent[] = [
  {
    id: "fixture-b-sponge",
    type: "sponge_tilt_out",
    enabled: true,
    sourceRef: bibbQuote("Tilt out for Sponges"),
    verificationStatus: "verified",
  },
  {
    id: "fixture-b-sink-pullout",
    type: "sink_pullout",
    enabled: true,
    sourceRef: bibbQuote("Pull out under sink"),
    verificationStatus: "verified",
  },
];

export const BIBB_FIXTURE_B_ISLAND: CabinetInteriorComponent[] = [
  {
    id: "fixture-b-trash",
    type: "trash_pullout",
    enabled: true,
    bins: 2,                          // "DBL" is explicit
    nominalBinSizeQt: 35,             // "35 Qt" is explicit
    configuration: "double",
    sourceRef: bibbQuote("DBL 35 Qt Trash"),
    verificationStatus: "verified",
  },
  {
    id: "fixture-b-trays",
    type: "tray_divider",
    enabled: true,
    label: "Baking trays",
    sourceRef: bibbQuote("Baking trays"),
    verificationStatus: "verified",
    // No quantity: source lists "Baking trays" without count.
  },
  {
    id: "fixture-b-hidden-above-trash",
    type: "hidden_drawer",
    enabled: true,
    location: "above_trash",
    label: "Hidden small drawer above trash",
    sourceRef: bibbQuote("Hidden small drawer above trash"),
    verificationStatus: "verified",
  },
];

// ─── Fixture C — Bibb pullout cabinet ───────────────────────────────
//
// Evidence: pullout with open sides, small hidden drawer inside,
// drawer dividers, removable dividers. Quantity of the rollout is
// NOT evidenced in the source — omitted per §C.

export const BIBB_FIXTURE_C: CabinetInteriorComponent[] = [
  {
    id: "fixture-c-rollout",
    type: "rollout",
    enabled: true,
    openSides: true,                  // explicit: "Pull out with open sides"
    sourceRef: bibbQuote("Pull out with open sides"),
    verificationStatus: "verified",
    // No quantity: source does not specify.
  },
  {
    id: "fixture-c-hidden",
    type: "hidden_drawer",
    enabled: true,
    location: "inside_cabinet",
    label: "Small hidden drawer inside",
    sourceRef: bibbQuote("Small hidden drawer inside"),
    verificationStatus: "verified",
  },
  {
    id: "fixture-c-dividers",
    type: "drawer_divider",
    enabled: true,
    sourceRef: bibbQuote("Dividers in drawers"),
    verificationStatus: "verified",
  },
  {
    id: "fixture-c-dividers-removable",
    type: "drawer_divider",
    enabled: true,
    removable: true,
    sourceRef: bibbQuote("Removable dividers"),
    verificationStatus: "verified",
  },
];

// ─── Fixture — Klint rollout evidence ───────────────────────────────
//
// Evidence: "Roll Out Bottom", "Roll Out Back" appear as distinct
// items on Klint Anderson Build Sheets. Represented as a single
// rollout intent — the Bottom/Back distinction is a manufacturing
// detail deferred to a later Phase 3.x. Quantity not evidenced.

export const KLINT_ROLLOUT_FIXTURE: CabinetInteriorComponent[] = [
  {
    id: "fixture-klint-rollout",
    type: "rollout",
    enabled: true,
    // Klint build-sheet assembly IDs / page numbers are not captured
    // in the shared audit context — cite the exact source lines
    // instead of guessing a page.
    sourceRef: klintQuote("Roll Out Bottom; Roll Out Back"),
    verificationStatus: "verified",
    // No quantity, no openSides — source does not evidence either.
  },
];
