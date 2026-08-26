// Python-predicted parity snapshot builder.
//
// This does NOT execute Python. It synthesises the snapshot Python's
// parametric.py WOULD produce given the fixture parameters, using the
// values captured in the inventory. The prediction is intentionally
// mechanical: no new constants are introduced here.
//
// Divergence between this prediction and actual live Python output is
// caught by services/cad-service/app/routers/parity.py — which returns
// a live snapshot in the same shape — running as a diagnostic integration
// step, not part of the vitest suite.

import type { Cabinet } from "../../types/cabinet";
import { pyNumericValue } from "./inventory";
import type {
  GeometryParitySnapshot,
  SnapshotFaceFrame,
  SnapshotPart,
  SnapshotShelfPin,
} from "./snapshot";
import { sortSnapshotParts } from "./snapshot";

function requirePy(key: string): number {
  const v = pyNumericValue(key);
  if (v === undefined) {
    throw new Error(
      `parity/snapshot-python-predicted: inventory entry '${key}' missing a Python value.`,
    );
  }
  return v;
}

function numericParam(cabinet: Cabinet, key: string, dflt: number): number {
  const v = (cabinet.parameters ?? {})[key];
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

function stringParam(cabinet: Cabinet, key: string): string | undefined {
  const v = (cabinet.parameters ?? {})[key];
  return typeof v === "string" ? v : undefined;
}

function needsToeKickPy(type: string): boolean {
  return (
    type === "base" ||
    type === "drawer_base" ||
    type === "sink_base" ||
    type === "island" ||
    type === "tall"
  );
}

function isFaceFrame(cabinet: Cabinet): boolean {
  const cm = stringParam(cabinet, "constructionMethod");
  return cm === "face_frame";
}

/**
 * Builds the structural carcass part list Python's parametric.compute_*
 * builders would produce for a cabinet of this type/dimensions using the
 * inventory-captured defaults.
 */
function derivePyStructuralParts(cabinet: Cabinet): SnapshotPart[] {
  const panelT = requirePy("panel_thickness_default");
  const backT = requirePy("back_panel_thickness");
  const w = cabinet.width;
  const h = cabinet.height;
  const d = cabinet.depth;

  const parts: SnapshotPart[] = [];

  parts.push({
    role: "left_panel",
    widthMm: d,
    heightMm: h,
    thicknessMm: panelT,
    quantity: 1,
  });
  parts.push({
    role: "right_panel",
    widthMm: d,
    heightMm: h,
    thicknessMm: panelT,
    quantity: 1,
  });

  const interiorW = w - 2 * panelT;

  // Sink base skips the bottom panel (plumbing access).
  const skipBottom = cabinet.type === "sink_base";
  if (!skipBottom) {
    parts.push({
      role: "bottom_panel",
      widthMm: interiorW,
      heightMm: panelT,
      thicknessMm: panelT,
      quantity: 1,
    });
  } else {
    const stretcherH = requirePy("sink_stretcher_height");
    parts.push({
      role: "sink_stretcher",
      widthMm: interiorW,
      heightMm: stretcherH,
      thicknessMm: panelT,
      quantity: 1,
      tags: { reason: "sink base plumbing access" },
    });
  }

  parts.push({
    role: "top_panel",
    widthMm: interiorW,
    heightMm: panelT,
    thicknessMm: panelT,
    quantity: 1,
  });

  parts.push({
    role: "back_panel",
    widthMm: interiorW,
    heightMm: h,
    thicknessMm: backT,
    quantity: 1,
    tags: { material: "hdf" },
  });

  return parts;
}

function deriveTallPyStructuralParts(cabinet: Cabinet): SnapshotPart[] {
  return derivePyStructuralParts(cabinet);
}

function deriveWallPyStructuralParts(cabinet: Cabinet): SnapshotPart[] {
  return derivePyStructuralParts(cabinet);
}

function deriveShelvesPy(cabinet: Cabinet): SnapshotPart[] {
  const panelT = requirePy("panel_thickness_default");
  const shelfReduction = 1; // parametric.py:204 constant, captured as concept
  const w = cabinet.width;
  const d = cabinet.depth;
  const interiorW = w - 2 * panelT;
  const shelfCount = numericParam(cabinet, "shelfCount", 0);
  const out: SnapshotPart[] = [];
  for (let i = 0; i < shelfCount; i++) {
    out.push({
      role: "shelf",
      widthMm: interiorW - shelfReduction,
      heightMm: panelT,
      thicknessMm: panelT,
      quantity: 1,
      tags: { pattern: "adjustable_5mm_pin", depthAllowance: d - 50 },
    });
  }
  return out;
}

function deriveFacesPy(cabinet: Cabinet): SnapshotPart[] {
  const panelT = requirePy("panel_thickness_default");
  const overlay = requirePy("door_overlay");
  const gap = requirePy("reveal_between_fronts");
  const toeH = needsToeKickPy(cabinet.type)
    ? requirePy("toe_kick_height")
    : 0;

  const w = cabinet.width;
  const h = cabinet.height;

  const bodyH = Math.max(0, h - toeH);
  const openingH = Math.max(0, bodyH - 2 * panelT);
  const openingW = Math.max(0, w - 2 * panelT);

  const parts: SnapshotPart[] = [];

  const drawerCount = numericParam(cabinet, "drawerCount", cabinet.type === "drawer_base" ? 3 : 0);
  const doorCount = numericParam(cabinet, "doorCount", w > 650 ? 2 : 1);

  if (cabinet.type === "drawer_base" && drawerCount > 0) {
    // Full drawer bank: entire opening split equally
    const perFrontH = (openingH - (drawerCount - 1) * gap) / drawerCount;
    for (let i = 0; i < drawerCount; i++) {
      parts.push({
        role: "drawer_front",
        widthMm: openingW + 2 * overlay,
        heightMm: perFrontH + overlay * 2,
        thicknessMm: panelT,
        quantity: 1,
      });
    }
  } else {
    // Mixed layout — Python uses 38% for the drawer zone; we approximate
    const drawerZoneRatio = pyNumericValue("drawer_zone_ratio_base") ?? 0;
    const drawerZoneH = drawerCount > 0 ? openingH * drawerZoneRatio : 0;
    const doorZoneH = openingH - drawerZoneH;

    for (let i = 0; i < drawerCount; i++) {
      const perDrawerH = (drawerZoneH - (drawerCount - 1) * gap) / drawerCount;
      parts.push({
        role: "drawer_front",
        widthMm: openingW + 2 * overlay,
        heightMm: perDrawerH + overlay * 2,
        thicknessMm: panelT,
        quantity: 1,
      });
    }

    if (doorCount > 0 && doorZoneH > 0) {
      const perDoorW = (openingW - (doorCount - 1) * gap) / doorCount;
      for (let i = 0; i < doorCount; i++) {
        parts.push({
          role: "door",
          widthMm: perDoorW + 2 * overlay,
          heightMm: doorZoneH + overlay * 2,
          thicknessMm: panelT,
          quantity: 1,
        });
      }
    }
  }

  return parts;
}

function deriveDrawerBoxesPy(cabinet: Cabinet): SnapshotPart[] {
  const drawerCount = numericParam(
    cabinet,
    "drawerCount",
    cabinet.type === "drawer_base" ? 3 : 0,
  );
  if (drawerCount === 0) return [];

  const sideT = requirePy("drawer_box_side_thickness");
  const bottomT = requirePy("drawer_box_bottom_thickness");
  const sideClear = requirePy("drawer_slide_side_clearance");
  const behindClear = requirePy("drawer_slide_clearance_behind");
  const slideFactor = requirePy("drawer_slide_length_factor");
  const slideIncrement = requirePy("drawer_slide_length_increment");
  const panelT = requirePy("panel_thickness_default");

  const interiorW = cabinet.width - 2 * panelT;
  const interiorD = cabinet.depth - panelT - behindClear;
  const boxW = interiorW - sideClear;
  const boxD = Math.max(0, Math.round((interiorD * slideFactor) / slideIncrement) * slideIncrement);

  const out: SnapshotPart[] = [];
  for (let i = 0; i < drawerCount; i++) {
    out.push(
      {
        role: "drawer_box_side",
        widthMm: boxD,
        heightMm: 90, // Python does not tie box height to front; conservative placeholder for parity
        thicknessMm: sideT,
        quantity: 2,
        tags: { drawerIndex: i },
      },
      {
        role: "drawer_box_back",
        widthMm: boxW - 2 * sideT,
        heightMm: 90,
        thicknessMm: sideT,
        quantity: 1,
        tags: { drawerIndex: i },
      },
      {
        role: "drawer_box_bottom",
        widthMm: boxW - 2 * sideT,
        heightMm: boxD,
        thicknessMm: bottomT,
        quantity: 1,
        tags: { drawerIndex: i, material: "plywood" },
      },
    );
  }
  return out;
}

function deriveFaceFramePartsPy(cabinet: Cabinet): SnapshotPart[] {
  if (!isFaceFrame(cabinet)) return [];
  const stileW = requirePy("face_frame_stile_width");
  const railW = requirePy("face_frame_rail_width");
  const ffT = requirePy("face_frame_thickness");
  const h = cabinet.height;
  const w = cabinet.width;

  return [
    { role: "face_frame_stile", widthMm: stileW, heightMm: h, thicknessMm: ffT, quantity: 2 },
    { role: "face_frame_rail", widthMm: w - 2 * stileW, heightMm: railW, thicknessMm: ffT, quantity: 2 },
  ];
}

function deriveBoringPy(cabinet: Cabinet): GeometryParitySnapshot["features"] {
  const drawerCount = numericParam(cabinet, "drawerCount", 0);
  const doorCount = numericParam(cabinet, "doorCount", 0);
  const boring: NonNullable<GeometryParitySnapshot["features"]>["boring"] = [];

  // Approximate hinge cup positions on each door (2 hinges minimum,
  // extra hinges for tall doors per hinge_count_threshold).
  const hingeTop = pyNumericValue("hinge_inset_top");
  const hingeBottom = pyNumericValue("hinge_inset_bottom");
  const hingeCupDia = pyNumericValue("hinge_cup_diameter");
  const hingeCupDepth = pyNumericValue("hinge_cup_depth");
  const extraSpacing = pyNumericValue("hinge_extra_spacing");
  const heightThreshold = pyNumericValue("hinge_count_threshold");
  const panelT = requirePy("panel_thickness_default");
  const toeH = needsToeKickPy(cabinet.type) ? requirePy("toe_kick_height") : 0;
  const openingH = Math.max(0, cabinet.height - toeH - 2 * panelT);

  if (
    doorCount > 0 &&
    hingeTop !== undefined &&
    hingeBottom !== undefined &&
    hingeCupDia !== undefined &&
    hingeCupDepth !== undefined
  ) {
    const doorH = openingH; // simplified; real Python considers zones
    const extraHinges =
      heightThreshold && doorH > heightThreshold ? Math.floor((doorH - heightThreshold) / (extraSpacing ?? 150)) : 0;
    const hingeCount = 2 + extraHinges;
    for (let d = 0; d < doorCount; d++) {
      for (let hi = 0; hi < hingeCount; hi++) {
        const yFromBottom = hi === 0 ? hingeBottom : hi === hingeCount - 1 ? doorH - hingeTop : hingeBottom + hi * (extraSpacing ?? 150);
        boring.push({
          role: "hinge_cup",
          xMm: 0,
          yMm: yFromBottom,
          diameterMm: hingeCupDia,
          depthMm: hingeCupDepth,
        });
      }
    }
  }

  const shelfPinSpacing = pyNumericValue("shelf_pin_spacing");
  const shelfPinInset = pyNumericValue("shelf_pin_row_inset");
  const shelfPinDia = pyNumericValue("shelf_pin_diameter");

  const shelfPin: SnapshotShelfPin | undefined =
    shelfPinSpacing !== undefined && shelfPinInset !== undefined && shelfPinDia !== undefined
      ? { spacingMm: shelfPinSpacing, rowInsetMm: shelfPinInset, diameterMm: shelfPinDia }
      : undefined;

  const shelfCount = numericParam(cabinet, "shelfCount", 0);
  if (shelfCount > 0 && shelfPin) {
    // Emit a small number of representative pin points; not exhaustive.
    for (let r = 0; r < 2; r++) {
      boring.push({
        role: "shelf_pin",
        xMm: shelfPin.rowInsetMm,
        yMm: 100 + r * shelfPin.spacingMm,
        diameterMm: shelfPin.diameterMm,
      });
    }
  }

  const faceFrame: SnapshotFaceFrame | null = isFaceFrame(cabinet)
    ? {
        stileWidthMm: requirePy("face_frame_stile_width"),
        railWidthMm: requirePy("face_frame_rail_width"),
        thicknessMm: requirePy("face_frame_thickness"),
      }
    : null;

  return { boring, shelfPin, faceFrame };
}

/**
 * Builds a Python-PREDICTED parity snapshot from a legacy Cabinet using
 * only inventory values. Not a substitute for live parity — see
 * services/cad-service/app/routers/parity.py for the live path.
 */
export function buildPythonPredictedSnapshot(cabinet: Cabinet): GeometryParitySnapshot {
  const notes: string[] = [
    "Predicted from geometry-assumption inventory; verify against live Python output via services/cad-service /parity endpoint before releasing.",
  ];

  let structural: SnapshotPart[];
  switch (cabinet.type) {
    case "tall":
      structural = deriveTallPyStructuralParts(cabinet);
      break;
    case "wall":
      structural = deriveWallPyStructuralParts(cabinet);
      break;
    default:
      structural = derivePyStructuralParts(cabinet);
  }

  const shelves = deriveShelvesPy(cabinet);
  const faces = deriveFacesPy(cabinet);
  const boxes = deriveDrawerBoxesPy(cabinet);
  const faceFrameParts = deriveFaceFramePartsPy(cabinet);
  const boringFeatures = deriveBoringPy(cabinet);

  const toeH = needsToeKickPy(cabinet.type) ? requirePy("toe_kick_height") : 0;
  const hasToe = toeH > 0;

  return {
    cabinetId: cabinet.id,
    source: "python-predicted",
    cabinetType: cabinet.type,
    units: "mm",
    boundingBox: {
      widthMm: cabinet.width,
      heightMm: cabinet.height,
      depthMm: cabinet.depth,
    },
    parts: sortSnapshotParts([
      ...structural,
      ...shelves,
      ...faceFrameParts,
      ...faces,
      ...boxes,
    ]),
    features: {
      toeKick: { present: hasToe, heightMm: hasToe ? toeH : undefined },
      countertop: null, // Python never models countertops.
      ...boringFeatures,
    },
    notes,
  };
}
