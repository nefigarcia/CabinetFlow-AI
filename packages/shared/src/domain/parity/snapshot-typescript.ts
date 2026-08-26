// TypeScript-side parity snapshot builder.
//
// Reads the LEGACY `Cabinet` shape (that's what the compiler expects today)
// and calls the actual production compiler in packages/shared/src/types/
// geometry.ts (compileUnit) to derive the visual features. Structural
// panels (left/right/top/bottom/toe_kick physical) are DERIVED from the
// inventory constants because the TS compiler does not emit them as
// individual parts — TS's job today is layout for the 3D scene, not the
// cut list.
//
// The derivation is intentionally rigid: it uses the same PANEL_T_MM and
// TOE_MM values that the compiler uses (mirrored via the inventory). If
// either side changes, tests catch the drift.

import type { Cabinet } from "../../types/cabinet";
import type { CabinetSpecInput } from "../../types/geometry";
import { compileUnit } from "../../types/geometry";
import {
  tsNumericValue,
} from "./inventory";
import type {
  GeometryParitySnapshot,
  SnapshotFront,
  SnapshotPart,
} from "./snapshot";
import { sortSnapshotParts } from "./snapshot";

function specFromLegacy(cabinet: Cabinet): CabinetSpecInput {
  return {
    name: cabinet.name,
    type: cabinet.type,
    width: cabinet.width,
    height: cabinet.height,
    depth: cabinet.depth,
    posX: cabinet.posX,
    posY: cabinet.posY,
    posZ: cabinet.posZ,
    parameters: (cabinet.parameters ?? {}) as CabinetSpecInput["parameters"],
  };
}

function requireTsValue(key: string): number {
  const v = tsNumericValue(key);
  if (v === undefined) {
    throw new Error(
      `parity/snapshot-typescript: inventory entry '${key}' missing a TS value.`,
    );
  }
  return v;
}

/**
 * Derives structural carcass parts (left/right/top/bottom + toe kick) that
 * the TS compiler does NOT emit natively. Used for cut-list-level parity.
 * Values come exclusively from the inventory — this function does not
 * introduce any new hardcoded dimensions.
 */
function deriveTsStructuralParts(
  cabinet: Cabinet,
  hasToeKick: boolean,
  toeKickHeightMm: number,
): SnapshotPart[] {
  const panelT = requireTsValue("panel_thickness_default");
  const w = cabinet.width;
  const h = cabinet.height;
  const d = cabinet.depth;

  const parts: SnapshotPart[] = [
    {
      role: "left_panel",
      widthMm: d,
      heightMm: h,
      thicknessMm: panelT,
      quantity: 1,
    },
    {
      role: "right_panel",
      widthMm: d,
      heightMm: h,
      thicknessMm: panelT,
      quantity: 1,
    },
    {
      role: "top_panel",
      widthMm: w - 2 * panelT,
      heightMm: panelT,
      thicknessMm: panelT,
      quantity: 1,
    },
    {
      role: "bottom_panel",
      widthMm: w - 2 * panelT,
      heightMm: panelT,
      thicknessMm: panelT,
      quantity: 1,
    },
  ];

  if (hasToeKick && toeKickHeightMm > 0) {
    parts.push({
      role: "toe_kick",
      widthMm: w - 2 * panelT,
      heightMm: toeKickHeightMm,
      thicknessMm: panelT,
      quantity: 1,
      tags: { note: "TS geometry has no explicit toe-kick part; derived from body-height subtraction." },
    });
  }

  // Shelf count from cabinet parameters; TS assumes shelves are same panel
  // thickness. No pin patterns modeled.
  const shelfCount = numericParam(cabinet, "shelfCount", 0);
  const shelfDepthReduction = 12; // conservative "hangs back from front" — not in inventory; noted below
  for (let i = 0; i < shelfCount; i++) {
    parts.push({
      role: "shelf",
      widthMm: w - 2 * panelT,
      heightMm: panelT,
      thicknessMm: panelT,
      quantity: 1,
      tags: { note: "shelf depth reduction not modeled in TS", shelfDepthReduction },
    });
  }

  return parts;
}

function numericParam(cabinet: Cabinet, key: string, dflt: number): number {
  const v = (cabinet.parameters ?? {})[key];
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

/**
 * Builds a parity snapshot from the TypeScript geometry compiler. The
 * `compileUnit` call is UNMODIFIED production code; this function only
 * translates its output into the parity schema.
 */
export function buildTypeScriptSnapshot(cabinet: Cabinet): GeometryParitySnapshot {
  const spec = specFromLegacy(cabinet);
  const finish = String(spec.parameters.finishStyle ?? "");
  const compiled = compileUnit(spec, finish, 0);

  const toeKickPresent = (compiled.features?.toeKickHeightMm ?? 0) > 0;
  const toeKickHeight = compiled.features?.toeKickHeightMm ?? 0;

  const notes: string[] = [];

  const fronts: SnapshotFront[] = (compiled.features?.fronts ?? []).map((f) => ({
    kind: f.kind,
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    thicknessMm: f.thicknessMm,
    position: { xMm: f.x, yMm: f.y, zMm: 0 },
  }));

  const structural = deriveTsStructuralParts(cabinet, toeKickPresent, toeKickHeight);

  // Turn each visual front into a manufacturing part row (door / drawer_front).
  const frontParts: SnapshotPart[] = fronts.map((f) => ({
    role: f.kind === "door" ? "door" : "drawer_front",
    widthMm: f.widthMm,
    heightMm: f.heightMm,
    thicknessMm: f.thicknessMm,
    quantity: 1,
    position: f.position,
  }));

  // Open-shelf carcass panels: TS compiler DOES emit these; include them.
  const openShelfParts: SnapshotPart[] = (compiled.features?.shelves ?? []).map(
    (s) => ({
      role: mapOpenShelfKindToPartRole(s.kind),
      widthMm: s.widthMm,
      heightMm: s.heightMm,
      thicknessMm: Math.min(s.widthMm, s.heightMm, s.depthMm),
      quantity: 1,
      position: { xMm: s.x, yMm: s.y, zMm: s.z },
      tags: { origin: "open_shelf_grid" },
    }),
  );

  if ((compiled.features?.fronts?.length ?? 0) === 0 && openShelfParts.length === 0) {
    notes.push(
      "TS compiler emitted no visual features for this cabinet (role != 'cabinet' or role == 'opening'/'led_strip').",
    );
  }

  const countertop = compiled.features?.countertop
    ? {
        thicknessMm: compiled.features.countertop.thicknessMm,
        frontOverhangMm: compiled.features.countertop.overhangFrontMm,
        sideOverhangMm: compiled.features.countertop.overhangSidesMm,
      }
    : null;

  const parts = sortSnapshotParts(
    // For an open_shelf cabinet the compiler already emits carcass shelves;
    // avoid double-counting by dropping the derived structural set in that
    // case.
    openShelfParts.length > 0
      ? [...openShelfParts, ...frontParts]
      : [...structural, ...frontParts],
  );

  return {
    cabinetId: cabinet.id,
    source: "typescript",
    cabinetType: cabinet.type,
    units: "mm",
    boundingBox: {
      widthMm: cabinet.width,
      heightMm: cabinet.height,
      depthMm: cabinet.depth,
    },
    parts,
    features: {
      toeKick: {
        present: toeKickPresent,
        heightMm: toeKickPresent ? toeKickHeight : undefined,
      },
      fronts,
      countertop,
      faceFrame: null, // TS never models face frames.
      boring: [], // TS never emits boring.
      shelfPin: undefined, // TS never models pin patterns.
    },
    notes: notes.length > 0 ? notes : undefined,
  };
}

function mapOpenShelfKindToPartRole(
  kind:
    | "horizontal_shelf"
    | "vertical_divider"
    | "back_panel"
    | "left_panel"
    | "right_panel"
    | "top_panel"
    | "bottom_panel",
): SnapshotPart["role"] {
  return kind;
}
