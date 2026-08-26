// Parity fixture registry.
//
// Reuses the legacy fixture cabinets defined for the V2 domain tests where
// possible, and adds one plain wall cabinet for a complete parity set.
// Adding a new fixture: append to PARITY_FIXTURES with a stable id and the
// legacy Cabinet payload. Do NOT modify the existing legacy fixtures.

import type { Cabinet } from "../../types/cabinet";
import {
  legacyAdjustableShelfCabinet,
  legacyCabinetWithManualPart,
  legacyFaceFrameBase,
  legacyFramelessBase,
  legacyFramelessThreeDrawerBase,
  legacySinkBase,
  legacyTallCabinet,
} from "../__tests__/fixtures";

export interface ParityFixture {
  id: string;
  label: string;
  cabinet: Cabinet;
  /** True when this fixture is expected to exhibit at least one difference. */
  expectedDivergent: boolean;
  /** Optional list of inventory keys the fixture is intended to exercise. */
  exercises: readonly string[];
}

const wallCabinet: Cabinet = {
  id: "cab_wall_900",
  roomId: "room_1",
  orgId: "org_1",
  type: "wall",
  name: "Wall Cabinet 900",
  width: 900,
  height: 720,
  depth: 320,
  posX: 0,
  posY: 1400,
  posZ: 0,
  parameters: { role: "cabinet", doorCount: 2, shelfCount: 1 },
  materialId: null,
  parts: [],
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

export const PARITY_FIXTURES: readonly ParityFixture[] = [
  {
    id: "frameless-base",
    label: "Frameless base cabinet (1 door)",
    cabinet: legacyFramelessBase,
    expectedDivergent: true,
    exercises: [
      "panel_thickness_default",
      "toe_kick_height",
      "door_thickness",
      "back_panel_thickness",
    ],
  },
  {
    id: "frameless-3drawer-base",
    label: "Frameless 3-drawer base",
    cabinet: legacyFramelessThreeDrawerBase,
    expectedDivergent: true,
    exercises: [
      "drawer_box_side_thickness",
      "drawer_slide_side_clearance",
      "drawer_slide_length_factor",
    ],
  },
  {
    id: "wall-cabinet",
    label: "Wall cabinet 900 (2 doors, 1 shelf)",
    cabinet: wallCabinet,
    expectedDivergent: true,
    exercises: ["panel_thickness_default", "shelf_thickness"],
  },
  {
    id: "tall-cabinet",
    label: "Tall pantry 600 (2 doors, 5 shelves)",
    cabinet: legacyTallCabinet,
    expectedDivergent: true,
    exercises: [
      "toe_kick_height",
      "panel_thickness_default",
      "shelf_pin_spacing",
    ],
  },
  {
    id: "sink-base",
    label: "Sink base 900",
    cabinet: legacySinkBase,
    expectedDivergent: true,
    exercises: ["sink_stretcher_height", "back_panel_thickness"],
  },
  {
    id: "adjustable-shelves",
    label: "Wall cabinet with adjustable shelves",
    cabinet: legacyAdjustableShelfCabinet,
    expectedDivergent: true,
    exercises: ["shelf_pin_spacing", "shelf_pin_row_inset", "shelf_pin_diameter"],
  },
  {
    id: "face-frame-base",
    label: "Face-frame base cabinet",
    cabinet: legacyFaceFrameBase,
    expectedDivergent: true,
    exercises: [
      "face_frame_stile_width",
      "face_frame_rail_width",
      "face_frame_thickness",
    ],
  },
  {
    id: "manual-part-cabinet",
    label: "Base cabinet with manual/custom filler part",
    cabinet: legacyCabinetWithManualPart,
    expectedDivergent: true,
    exercises: ["panel_thickness_default"],
  },
];

export function findFixture(id: string): ParityFixture | undefined {
  return PARITY_FIXTURES.find((f) => f.id === id);
}
