// ── WoodCraft OS Geometry Compiler ────────────────────────────────────────────
// Turns a validated CabinetSpec (the JSON the AI produces + validation cleans up)
// into a deterministic, parametric CompiledGeometry that every downstream tool
// reads from — 3D scene, DXF export, image prompt, elevation preview.
//
// Rule: the compiler is the ONLY place that decides "how many drawer fronts does
// a 24-inch drawer_base have" or "does this cabinet get a countertop". Downstream
// consumers just render what the compiler produced.

import type { CabinetType } from "./cabinet";

// ── Input (a subset of AICabinetSpec — every consumer already has this shape) ─

export interface CabinetSpecInput {
  name: string;
  type: CabinetType;
  width: number;
  height: number;
  depth: number;
  posX?: number;
  posY?: number;
  posZ?: number;
  parameters: {
    role?: "cabinet" | "opening" | "led_strip" | "open_shelf";
    doorCount?: number;
    drawerCount?: number;
    shelfCount?: number;
    toeKickHeight?: number;
    finishStyle?: string;
    /** For role="open_shelf": how many vertical bays (dividers + 1). */
    columns?: number;
    /** For role="open_shelf": how many horizontal rows (shelves + 1). */
    rows?: number;
    [key: string]: unknown;
  };
  notes?: string;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface CompiledHandle {
  x: number;               // mm from cabinet's back-left-bottom
  y: number;               // mm from cabinet's back-left-bottom
  orientation: "horizontal" | "vertical";
  lengthMm: number;
}

export interface CompiledFrontPanel {
  kind: "door" | "drawer";
  x: number;               // mm, local to cabinet, X = along width
  y: number;               // mm, local to cabinet, Y = vertical
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  hasShakerInset: boolean; // false for gloss slab, true for shaker style
  handle: CompiledHandle | null;
}

export interface CompiledCountertop {
  thicknessMm: number;
  overhangFrontMm: number;
  overhangSidesMm: number;
}

// Interior carcass parts. All coordinates are cabinet-local (origin at
// back-left-bottom, mm). Emitted for open-shelf units so cubbies show up in the
// 3D scene and DXF export.
export interface CompiledShelf {
  id: string;
  kind:
    | "horizontal_shelf"
    | "vertical_divider"
    | "back_panel"
    | "left_panel"
    | "right_panel"
    | "top_panel"
    | "bottom_panel";
  x: number;
  y: number;
  z: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export interface CompiledFeatures {
  toeKickHeightMm: number;                 // 0 = none
  countertop: CompiledCountertop | null;
  fronts: CompiledFrontPanel[];
  shelves: CompiledShelf[];                // empty for closed cabinets
}

export type RowClass =
  | "base"     // floor-level base / drawer_base / sink_base
  | "middle"   // wall units between base and top rows (open shelves etc.)
  | "upper"    // upper bridge / overhead wall units
  | "tower"    // full-height tall units
  | "island"   // free-standing islands
  | "other";

export interface CompiledUnit {
  id: string;
  name: string;
  type: CabinetType;
  role: "cabinet" | "opening" | "led_strip" | "open_shelf";
  finishStyle: string;
  // World-space bounding box (mm) with origin = back-left corner of the room at floor
  posX: number; posY: number; posZ: number;
  width: number; height: number; depth: number;
  features: CompiledFeatures | null; // null for openings and LED strips
  rowClass: RowClass;
}

export interface CompiledSummary {
  unitCount: number;         // role === "cabinet" only
  towerCount: number;
  baseRowCount: number;
  midRowCount: number;
  topRowCount: number;
  doorCount: number;
  drawerCount: number;
  ledStripCount: number;
  tvRecessCount: number;
  openShelfCount: number;    // role === "open_shelf"
  shelfPanelCount: number;   // total horizontal shelves + dividers + back panels
}

export interface CompiledOverall {
  widthMm: number;
  maxHeightMm: number;
  depthMm: number;
  primaryFinish: string;
  roomType: string;
}

export interface TvRecess {
  widthMm: number;
  heightMm: number;
  posX: number;
  posY: number;
}

export interface CompiledGeometry {
  overall: CompiledOverall;
  summary: CompiledSummary;
  units: CompiledUnit[];
  tvRecess: TvRecess | null;
}

// ── Deterministic constants (mirror the 3D renderer's cabinet detail constants) ─

const TOE_MM         = 89;   // 3.5" toe-kick height
const DOOR_T_MM      = 19;   // door / drawer slab thickness
const HANDLE_L_MM    = 96;   // handle bar length
const HANDLE_INSET_MM = 35;  // distance from door edge to handle centerline
const PGAP_MM        = 2;    // reveal gap between adjacent front panels
const COUNTERTOP_MM  = 38;
const COUNTERTOP_OVF = 19;   // front overhang (kitchen base)
const COUNTERTOP_OVI = 38;   // all-sides overhang (island)
const PANEL_T_MM     = 19;   // 3/4" nominal panel thickness (shelves, dividers, back)

function isKitchenHeight(heightMm: number): boolean {
  return heightMm >= 800 && heightMm <= 950;
}

function classifyRow(type: CabinetType, posY: number): RowClass {
  if (type === "tall")   return "tower";
  if (type === "island") return "island";
  if (posY < 300)        return "base";
  if (posY < 1400)       return "middle";
  return "upper";
}

function needsToeKick(type: CabinetType): boolean {
  return type === "base" || type === "drawer_base" || type === "sink_base" || type === "island" || type === "tall";
}

function needsCountertop(type: CabinetType, heightMm: number): boolean {
  if (type === "island") return true;
  if (!isKitchenHeight(heightMm)) return false;
  return type === "base" || type === "sink_base";
}

function autoDoorCount(width: number, explicit?: number): number {
  if (typeof explicit === "number" && explicit > 0) return explicit;
  return width > 650 ? 2 : 1;
}

function autoDrawerCount(type: CabinetType, explicit?: number): number {
  if (typeof explicit === "number" && explicit >= 0) return explicit;
  return type === "drawer_base" ? 3 : 0;
}

// ── Front-panel layout (single source of truth used by 3D + DXF + preview) ────
// Mirrors buildFrontPanels() + handle positioning in CabinetEditor.tsx but
// expressed in mm and with richer per-panel data (handle positions, shaker flag).
// Handle x/y are the CENTER of the handle bar (Three.js boxGeometry centers on
// its mesh position).

function compileFrontPanels(
  cab: CabinetSpecInput,
  toeKickHeightMm: number,
): CompiledFrontPanel[] {
  const w = cab.width;
  const h = cab.height;
  const type = cab.type;

  const doors   = autoDoorCount(w, cab.parameters.doorCount);
  const drawers = autoDrawerCount(type, cab.parameters.drawerCount);

  const bodyH   = Math.max(0, h - toeKickHeightMm);
  const dc      = Math.min(drawers, 5);

  // drawer_base is a FULL drawer bank — split the entire body across all
  // drawers with NO doors below. For anything else, drawers stack on top
  // and doors fill whatever's left (kitchen "utensil drawer over cabinet doors").
  const fullDrawerBank = type === "drawer_base" && dc > 0;
  const drawerH = dc > 0
    ? (fullDrawerBank
        ? Math.max(60, (bodyH - dc * PGAP_MM) / dc)      // full split, min 60 mm per drawer
        : Math.min(210, (bodyH * 0.45) / dc))            // capped mixed layout
    : 0;
  const drawerTot = dc * (drawerH + PGAP_MM);
  const doorH   = fullDrawerBank ? 0 : bodyH - drawerTot;

  const fronts: CompiledFrontPanel[] = [];

  // Drawers stack near the top of the cabinet body. For full drawer banks,
  // "top" reaches the very top (doorH === 0). For mixed layouts, they sit
  // above the door region.
  for (let i = 0; i < dc; i++) {
    const dy = toeKickHeightMm + doorH + i * (drawerH + PGAP_MM);
    const dw = w - 2 * PGAP_MM;
    fronts.push({
      kind: "drawer",
      x: PGAP_MM,
      y: dy,
      widthMm: dw,
      heightMm: drawerH,
      thicknessMm: DOOR_T_MM,
      hasShakerInset: false,
      // Handle centered horizontally and vertically on the drawer front
      handle: {
        x: w / 2,
        y: dy + drawerH / 2,
        orientation: "horizontal",
        lengthMm: HANDLE_L_MM,
      },
    });
  }

  // Doors fill the remaining space along the bottom (skipped for full drawer banks)
  const fc = Math.max(1, Math.min(doors, 4));
  if (doorH > 80) {
    const doorW = (w - (fc + 1) * PGAP_MM) / fc;
    const doorPanelY  = toeKickHeightMm + PGAP_MM;
    const doorPanelH  = doorH - 2 * PGAP_MM;
    for (let i = 0; i < fc; i++) {
      const dx = PGAP_MM + i * (doorW + PGAP_MM);
      fronts.push({
        kind: "door",
        x: dx,
        y: doorPanelY,
        widthMm: doorW,
        heightMm: doorPanelH,
        thicknessMm: DOOR_T_MM,
        hasShakerInset: true,
        // Vertical handle on the pull-side (right edge of door), lower quarter.
        // Matches the original renderer's `hy = py - ph/4` semantics exactly.
        handle: {
          x: dx + doorW - HANDLE_INSET_MM,
          y: doorPanelY + doorPanelH / 4,
          orientation: "vertical",
          lengthMm: HANDLE_L_MM,
        },
      });
    }
  }

  return fronts;
}

// ── Open-shelf carcass grid (back panel + horizontal shelves + vertical dividers) ─
// Deterministic column/row grid used for `role: "open_shelf"` units (display
// cubbies). Skips fronts, toe kick, and countertop — this IS the visible cabinet.

// Denser default column/row tiers — a 900 mm shelf gets a real visible grid,
// not a single-column empty box. Kept in sync with the API route's fallback.
function defaultColumns(widthMm: number): number {
  if (widthMm > 1200) return 4;
  if (widthMm > 800)  return 3;
  if (widthMm > 450)  return 2;
  return 1;
}
function defaultRows(heightMm: number): number {
  if (heightMm > 1200) return 4;
  if (heightMm > 700)  return 3;
  if (heightMm > 350)  return 2;
  return 1;
}

function compileOpenShelfGrid(cab: CabinetSpecInput, unitId: string): CompiledShelf[] {
  const w = cab.width;
  const h = cab.height;
  const d = cab.depth;

  const columns = Math.max(1, Math.min(4, Number(cab.parameters.columns ?? defaultColumns(w))));
  const rows    = Math.max(1, Math.min(5, Number(cab.parameters.rows    ?? defaultRows(h))));

  const shelves: CompiledShelf[] = [];

  // Outer frame — bottom, top, left, right. The open shelf is a see-through box,
  // so CabinetMesh does NOT draw a solid carcass; these four panels + the back
  // panel + internal shelves/dividers together form the visible cabinet.
  shelves.push({
    id: `${unitId}__bottom_panel`,
    kind: "bottom_panel",
    x: 0, y: 0, z: 0,
    widthMm: w, heightMm: PANEL_T_MM, depthMm: d,
  });
  shelves.push({
    id: `${unitId}__top_panel`,
    kind: "top_panel",
    x: 0, y: Math.max(0, h - PANEL_T_MM), z: 0,
    widthMm: w, heightMm: PANEL_T_MM, depthMm: d,
  });
  shelves.push({
    id: `${unitId}__left_panel`,
    kind: "left_panel",
    x: 0, y: 0, z: 0,
    widthMm: PANEL_T_MM, heightMm: h, depthMm: d,
  });
  shelves.push({
    id: `${unitId}__right_panel`,
    kind: "right_panel",
    x: Math.max(0, w - PANEL_T_MM), y: 0, z: 0,
    widthMm: PANEL_T_MM, heightMm: h, depthMm: d,
  });

  // Back panel — sits against the back of the carcass
  shelves.push({
    id: `${unitId}__back_panel`,
    kind: "back_panel",
    x: 0, y: 0, z: Math.max(0, d - PANEL_T_MM),
    widthMm: w, heightMm: h, depthMm: PANEL_T_MM,
  });

  // Horizontal shelves — one at each interior row boundary
  const interiorW = Math.max(0, w - 2 * PANEL_T_MM);
  for (let r = 1; r < rows; r++) {
    shelves.push({
      id: `${unitId}__h_shelf_${r}`,
      kind: "horizontal_shelf",
      x: PANEL_T_MM,
      y: (h / rows) * r - PANEL_T_MM / 2,
      z: 0,
      widthMm: interiorW,
      heightMm: PANEL_T_MM,
      depthMm: Math.max(0, d - PANEL_T_MM),
    });
  }

  // Vertical dividers — one at each interior column boundary
  const interiorH = Math.max(0, h - 2 * PANEL_T_MM);
  for (let c = 1; c < columns; c++) {
    shelves.push({
      id: `${unitId}__v_divider_${c}`,
      kind: "vertical_divider",
      x: (w / columns) * c - PANEL_T_MM / 2,
      y: PANEL_T_MM,
      z: 0,
      widthMm: PANEL_T_MM,
      heightMm: interiorH,
      depthMm: Math.max(0, d - PANEL_T_MM),
    });
  }

  return shelves;
}

// ── Per-unit compiler (exported so 3D can compile a single DB cabinet) ────────

export function compileUnit(
  cab: CabinetSpecInput,
  primaryFinish: string,
  idx: number = 0,
): CompiledUnit {
  const rawRole  = cab.parameters.role ?? "cabinet";
  const rowClass = classifyRow(cab.type, cab.posY ?? 0);
  const finish   = cab.parameters.finishStyle ?? primaryFinish;
  const unitId   = `unit_${idx + 1}`;
  const base = {
    id: unitId,
    name: cab.name,
    type: cab.type,
    finishStyle: finish,
    posX: cab.posX ?? 0,
    posY: cab.posY ?? 0,
    posZ: cab.posZ ?? 0,
    width: cab.width,
    height: cab.height,
    depth: cab.depth,
    rowClass,
  };

  // Openings and LED strips have no cabinet features.
  if (rawRole === "opening" || rawRole === "led_strip") {
    return { ...base, role: rawRole, features: null };
  }

  // Open display shelves — cubby grid, no fronts, no toe kick, no countertop.
  // This is a display unit; whatever the AI called it (base/wall/tall), the
  // fact that it's `role: "open_shelf"` means the front is open air.
  if (rawRole === "open_shelf") {
    return {
      ...base,
      role: "open_shelf",
      features: {
        toeKickHeightMm: 0,
        countertop: null,
        fronts: [],
        shelves: compileOpenShelfGrid(cab, unitId),
      },
    };
  }

  // Default closed cabinet — toe kick + optional countertop + door/drawer fronts.
  const toeH     = needsToeKick(cab.type) ? TOE_MM : 0;
  const isIsland = cab.type === "island";
  const countertop: CompiledCountertop | null = needsCountertop(cab.type, cab.height)
    ? {
        thicknessMm: COUNTERTOP_MM,
        overhangFrontMm: isIsland ? COUNTERTOP_OVI : COUNTERTOP_OVF,
        overhangSidesMm: isIsland ? COUNTERTOP_OVI : 0,
      }
    : null;

  return {
    ...base,
    role: "cabinet",
    features: {
      toeKickHeightMm: toeH,
      countertop,
      fronts: compileFrontPanels(cab, toeH),
      shelves: [],
    },
  };
}

// ── The compiler ──────────────────────────────────────────────────────────────

// Detect upper/overhead cabinets by name — used to re-align them to the tower top.
const UPPER_CAB_RE = /\b(upper|overhead|bridge|top cabinet)\b/i;

// Two-pass adjustment: units the AI labels "Upper …" or "Overhead …" often
// arrive with posY in the middle band, so they end up floating between the
// tower top and the base row. Snap their top edge to the tower top so the
// wall reads as a proper 3-row layout.
function alignUppersToTowers(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const towerH = Math.max(0, ...cabinets.filter((c) => c.type === "tall").map((c) => c.height));
  if (towerH <= 0) return cabinets;
  return cabinets.map((cab) => {
    const text = `${cab.name ?? ""} ${cab.notes ?? ""}`;
    if (!UPPER_CAB_RE.test(text)) return cab;
    if (cab.type === "tall") return cab;                      // towers themselves are fine
    if (cab.parameters.role && cab.parameters.role !== "cabinet") return cab;
    const alignedY = Math.max(0, towerH - cab.height);
    return { ...cab, posY: alignedY };
  });
}

// ── Fix A: base row overlap repair ────────────────────────────────────────────
// If any floor-level base cabinet overlaps a tower (AI put them at posX=0 while
// the left tower also starts at 0), redistribute the whole base row equally
// into the inner span between the two outermost towers. Preserves count.

function repairBaseRowOverlaps(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const towers = cabinets
    .filter((c) => c.type === "tall")
    .sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  if (towers.length < 2) return cabinets;

  const leftTower  = towers[0]!;
  const rightTower = towers[towers.length - 1]!;
  const innerStartX = (leftTower.posX ?? 0) + leftTower.width;
  const innerEndX   = rightTower.posX ?? Infinity;
  if (innerEndX <= innerStartX) return cabinets;

  // Base row = floor-level physical cabinets that aren't towers, openings,
  // LED strips, or open shelves.
  const bases = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    if ((c.posY ?? 0) >= 300) return false;
    const role = c.parameters?.role;
    if (role === "opening" || role === "led_strip" || role === "open_shelf") return false;
    return true;
  });
  if (bases.length === 0) return cabinets;

  const hasOverlap = bases.some((c) => {
    const x1 = c.posX ?? 0;
    const x2 = x1 + c.width;
    return x1 < innerStartX || x2 > innerEndX;
  });
  if (!hasOverlap) return cabinets;

  const innerWidth = innerEndX - innerStartX;
  const unitWidth  = innerWidth / bases.length;

  const sortedBases = [...bases].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  const repaired = new Map<CabinetSpecInput, CabinetSpecInput>();
  sortedBases.forEach((u, i) => {
    repaired.set(u, { ...u, posX: innerStartX + unitWidth * i, width: unitWidth });
  });

  return cabinets.map((c) => repaired.get(c) ?? c);
}

// ── Shared helper: derive the inner span between the outermost towers ─────────
// Returns null when the room doesn't have a bookended tower pair (nothing to do).
function towerInnerSpan(
  cabinets: CabinetSpecInput[],
): { innerStartX: number; innerEndX: number; innerWidth: number; leftTower: CabinetSpecInput; rightTower: CabinetSpecInput } | null {
  const towers = cabinets
    .filter((c) => c.type === "tall")
    .sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  if (towers.length < 2) return null;
  const leftTower  = towers[0]!;
  const rightTower = towers[towers.length - 1]!;
  const innerStartX = (leftTower.posX ?? 0) + leftTower.width;
  const innerEndX   = rightTower.posX ?? Infinity;
  const innerWidth  = innerEndX - innerStartX;
  if (innerWidth <= 0) return null;
  return { innerStartX, innerEndX, innerWidth, leftTower, rightTower };
}

// ── Fix: middle-row layout repair (open_shelf / opening / led_strip) ────────
// The AI often computes middle row widths inconsistently:
//   · Sum > inner width → outer shelves overflow into towers (invisible)
//   · Sum < inner width → empty gap between last shelf and right tower
//   · Adjacent units overlap each other internally (right shelf spills into TV)
// Any of these triggers a repair. Units are grouped by column (same posX means
// same visual column — e.g. shelf + LED sitting above it share a column).
// Opening columns (TV recess) keep their width; non-opening columns are scaled
// to fill the leftover space; then everything chains from innerStartX.
function repairMiddleRowOverlaps(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const span = towerInnerSpan(cabinets);
  if (!span) return cabinets;
  const { innerStartX, innerEndX, innerWidth } = span;

  const middleUnits = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    const y = c.posY ?? 0;
    if (y < 300 || y >= 1400) return false;
    const role = c.parameters?.role;
    return role === "open_shelf" || role === "opening" || role === "led_strip";
  });
  if (middleUnits.length === 0) return cabinets;

  // Group units into "columns" by shared posX (within 20mm tolerance).
  // A shelf and the LED strip above it share a column.
  const TOL = 20;
  const sorted = [...middleUnits].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  interface Col { origX: number; width: number; units: CabinetSpecInput[]; isOpening: boolean }
  const columns: Col[] = [];
  for (const u of sorted) {
    const ux = u.posX ?? 0;
    const uw = u.width;
    const uIsOpening = u.parameters?.role === "opening";
    const existing = columns.find((c) => Math.abs(c.origX - ux) < TOL);
    if (existing) {
      existing.width = Math.max(existing.width, uw);
      existing.units.push(u);
      if (uIsOpening) existing.isOpening = true;
    } else {
      columns.push({ origX: ux, width: uw, units: [u], isOpening: uIsOpening });
    }
  }
  columns.sort((a, b) => a.origX - b.origX);

  // Detect any layout issue: overflow, internal overlap between columns,
  // boundary gap at either end.
  const overflow =
    columns[0]!.origX < innerStartX - TOL ||
    columns[columns.length - 1]!.origX + columns[columns.length - 1]!.width > innerEndX + TOL;

  let internalOverlap = false;
  for (let i = 0; i < columns.length - 1; i++) {
    const curEnd    = columns[i]!.origX + columns[i]!.width;
    const nextStart = columns[i + 1]!.origX;
    if (curEnd > nextStart + TOL) { internalOverlap = true; break; }
  }

  const boundaryGap =
    Math.abs(columns[0]!.origX - innerStartX) > TOL ||
    Math.abs((columns[columns.length - 1]!.origX + columns[columns.length - 1]!.width) - innerEndX) > TOL;

  if (!overflow && !internalOverlap && !boundaryGap) return cabinets;

  // Redistribute: preserve opening columns' widths, scale non-opening columns
  // to fill the leftover space.
  const openingsW    = columns.filter((c) => c.isOpening).reduce((s, c) => s + c.width, 0);
  const nonOpeningsW = columns.filter((c) => !c.isOpening).reduce((s, c) => s + c.width, 0);
  const availableForNonOpenings = Math.max(0, innerWidth - openingsW);
  const scale = nonOpeningsW > 0 ? availableForNonOpenings / nonOpeningsW : 1;

  const repaired = new Map<CabinetSpecInput, CabinetSpecInput>();
  let cursor = innerStartX;
  for (const col of columns) {
    const newW = col.isOpening ? col.width : col.width * scale;
    for (const u of col.units) {
      repaired.set(u, { ...u, posX: cursor, width: newW });
    }
    cursor += newW;
  }

  return cabinets.map((c) => repaired.get(c) ?? c);
}

// ── Fix: upper-row gap repair ────────────────────────────────────────────────
// The AI sometimes emits upper cabinets whose combined width falls short of the
// inner span, leaving black gaps between them and the towers. Redistribute the
// existing upper cabs equally across the full inner span. Never adds or removes
// units — just fixes widths and positions.
function repairUpperRowGaps(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const span = towerInnerSpan(cabinets);
  if (!span) return cabinets;
  const { innerStartX, innerEndX, innerWidth } = span;

  const upperUnits = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    const y = c.posY ?? 0;
    if (y < 1400) return false;
    const role = c.parameters?.role ?? "cabinet";
    return role === "cabinet"; // don't touch LED strips or openings
  });
  if (upperUnits.length === 0) return cabinets;

  const sorted = [...upperUnits].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  const TOL = 30;

  // Check for gaps: total width mismatch OR any internal gap
  const totalW = sorted.reduce((s, u) => s + u.width, 0);
  const widthMismatch = Math.abs(totalW - innerWidth) > TOL;

  let internalGap = false;
  let cursor = innerStartX;
  for (const u of sorted) {
    if (Math.abs((u.posX ?? 0) - cursor) > TOL) { internalGap = true; break; }
    cursor += u.width;
  }
  const boundaryGap = Math.abs((sorted[0]!.posX ?? 0) - innerStartX) > TOL ||
                      Math.abs(((sorted[sorted.length - 1]!.posX ?? 0) + sorted[sorted.length - 1]!.width) - innerEndX) > TOL;

  if (!widthMismatch && !internalGap && !boundaryGap) return cabinets;

  const unitWidth = innerWidth / upperUnits.length;
  const repaired = new Map<CabinetSpecInput, CabinetSpecInput>();
  sorted.forEach((u, i) => {
    repaired.set(u, { ...u, posX: innerStartX + unitWidth * i, width: unitWidth });
  });

  return cabinets.map((c) => repaired.get(c) ?? c);
}

// ── Fix: stretch middle row vertically to meet the upper row ─────────────────
// When the AI makes middle shelves too short (say 610mm tall) but the vertical
// gap between the base top and upper bottom is much larger (say 1219mm), the
// 3D shows dead black space above the shelves. Extend each middle-row unit's
// height to fill the gap, and shift any LED strips that were sitting at the
// old top edge up to the new top edge so they still crown the shelves.
function stretchMiddleRowToFillVertical(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const towers = cabinets.filter((c) => c.type === "tall");
  if (towers.length < 2) return cabinets;

  const middleRow = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    const y = c.posY ?? 0;
    if (y < 300 || y >= 1400) return false;
    const role = c.parameters?.role;
    return role === "open_shelf" || role === "opening";
  });
  if (middleRow.length === 0) return cabinets;

  const upperRow = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    const y = c.posY ?? 0;
    return y >= 1400 && (c.parameters?.role ?? "cabinet") === "cabinet";
  });
  if (upperRow.length === 0) return cabinets;

  const upperBottomY = Math.min(...upperRow.map((c) => c.posY ?? 0));
  const GAP_THRESHOLD = 200; // ignore gaps smaller than 20cm

  const repaired = new Map<CabinetSpecInput, CabinetSpecInput>();
  const oldTopByUnit = new Map<CabinetSpecInput, number>();

  for (const u of middleRow) {
    const y = u.posY ?? 0;
    const oldTop = y + u.height;
    oldTopByUnit.set(u, oldTop);
    const gap = upperBottomY - oldTop;
    if (gap > GAP_THRESHOLD) {
      repaired.set(u, { ...u, height: upperBottomY - y });
    }
  }
  if (repaired.size === 0) return cabinets;

  // Move LED strips that were sitting at the old top edge to the new top edge.
  const ledStrips = cabinets.filter((c) => c.parameters?.role === "led_strip");
  for (const led of ledStrips) {
    const ledY = led.posY ?? 0;
    const matched = middleRow.find((u) => {
      const oldTop = oldTopByUnit.get(u);
      return oldTop !== undefined && Math.abs(oldTop - ledY) < 30;
    });
    if (matched && repaired.has(matched)) {
      const stretched = repaired.get(matched)!;
      const newTopY = (stretched.posY ?? 0) + stretched.height;
      repaired.set(led, { ...led, posY: newTopY });
    }
  }

  return cabinets.map((c) => repaired.get(c) ?? c);
}

// ── Fix C: middle-row gap filler ──────────────────────────────────────────────
// When ALL middle-row units are open shelves (a display wall pattern), close
// any gap larger than 100 mm with an additional open shelf using the same Y,
// height, and depth. Never invents TVs or closed cabinets — only more shelves.

function fillMiddleRowGaps(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const towers = cabinets
    .filter((c) => c.type === "tall")
    .sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  if (towers.length < 2) return cabinets;

  // Look at everything in the middle band. If any middle unit is an opening
  // (TV recess) or closed cabinet, treat the design as intentional — don't fill.
  const middleUnits = cabinets.filter((c) => {
    if (c.type === "tall") return false;
    const y = c.posY ?? 0;
    return y >= 300 && y < 1400;
  });
  if (middleUnits.length < 1) return cabinets;

  const allOpenShelves = middleUnits.every((c) => c.parameters?.role === "open_shelf");
  if (!allOpenShelves) return cabinets;

  const leftTower  = towers[0]!;
  const rightTower = towers[towers.length - 1]!;
  const innerStartX = (leftTower.posX ?? 0) + leftTower.width;
  const innerEndX   = rightTower.posX ?? innerStartX;

  const sorted = [...middleUnits].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
  const template = sorted[0]!;
  const posY   = template.posY ?? 0;
  const height = template.height;
  const depth  = template.depth;
  const finishStyle =
    typeof template.parameters?.finishStyle === "string" ? template.parameters.finishStyle : undefined;

  const makeFiller = (x: number, w: number, idx: number): CabinetSpecInput => ({
    name: `Auto Filler Shelf ${idx + 1}`,
    type: "wall",
    width: w,
    height,
    depth,
    posX: x,
    posY,
    posZ: 0,
    parameters: {
      role: "open_shelf",
      columns: defaultColumns(w),
      rows: defaultRows(height),
      finishStyle,
    },
    notes: "Auto-inserted to fill middle-row gap",
  });

  const fillers: CabinetSpecInput[] = [];
  const GAP_THRESHOLD = 100; // ignore anything smaller than 10 cm

  // Gap before the first shelf
  const firstX = sorted[0]!.posX ?? 0;
  if (firstX - innerStartX > GAP_THRESHOLD) {
    fillers.push(makeFiller(innerStartX, firstX - innerStartX, fillers.length));
  }

  // Gaps between consecutive shelves
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur  = sorted[i]!;
    const next = sorted[i + 1]!;
    const curEnd    = (cur.posX ?? 0) + cur.width;
    const nextStart = next.posX ?? 0;
    if (nextStart - curEnd > GAP_THRESHOLD) {
      fillers.push(makeFiller(curEnd, nextStart - curEnd, fillers.length));
    }
  }

  // Gap after the last shelf
  const last = sorted[sorted.length - 1]!;
  const lastEnd = (last.posX ?? 0) + last.width;
  if (innerEndX - lastEnd > GAP_THRESHOLD) {
    fillers.push(makeFiller(lastEnd, innerEndX - lastEnd, fillers.length));
  }

  if (fillers.length === 0) return cabinets;

  return [...cabinets, ...fillers];
}

// Full pre-compile layout repair pipeline. Deterministic layout corrections
// applied to the raw spec so `classifyRow()` and geometry maths see the
// corrected positions/widths. Idempotent — safe to call more than once.
//   1. alignUppersToTowers       — snap "upper" cabinets to the tower top edge
//   2. repairBaseRowOverlaps     — redistribute base row into tower inner span
//                                  when the AI placed drawers behind a tower
//   3. repairMiddleRowOverlaps   — fit open-shelf/opening/LED units into inner
//                                  span so shelves don't disappear behind towers
//   4. fillMiddleRowGaps         — if all middle units are open shelves, close
//                                  any gap > 100mm with an auto-inserted shelf
//   5. repairUpperRowGaps        — redistribute upper cabinets equally across
//                                  inner span so there's no dead space
//   6. stretchMiddleRowToFillVertical — extend middle-row shelf heights so
//                                  their top edge meets the upper row bottom
//
// Callers that need the compiled geometry (image prompt, 3D scene, DXF export)
// go through compileGeometry which calls this internally. Callers that need
// the repaired INPUT spec (e.g. to persist to the DB with corrected positions)
// should call repairLayout directly before saving.
export function repairLayout(cabinets: CabinetSpecInput[]): CabinetSpecInput[] {
  const p1 = alignUppersToTowers(cabinets);
  const p2 = repairBaseRowOverlaps(p1);
  const p3 = repairMiddleRowOverlaps(p2);
  const p4 = fillMiddleRowGaps(p3);
  const p5 = repairUpperRowGaps(p4);
  const p6 = stretchMiddleRowToFillVertical(p5);
  return p6;
}

export function compileGeometry(
  cabinets: CabinetSpecInput[],
  roomLogic: { suggestedRoomWidth: number; suggestedRoomDepth: number },
  primaryFinish: string,
  roomType: string,
): CompiledGeometry {
  const repaired = repairLayout(cabinets);

  // Compile each unit.
  const units: CompiledUnit[] = repaired.map((cab, idx) => compileUnit(cab, primaryFinish, idx));

  // Summary — counts of everything the compiler produced
  const summary: CompiledSummary = {
    unitCount:       units.filter((u) => u.role === "cabinet").length,
    towerCount:      units.filter((u) => u.rowClass === "tower").length,
    baseRowCount:    units.filter((u) => u.role === "cabinet" && u.rowClass === "base").length,
    midRowCount:     units.filter((u) => u.role === "cabinet" && u.rowClass === "middle").length,
    topRowCount:     units.filter((u) => u.role === "cabinet" && u.rowClass === "upper").length,
    doorCount:       units.reduce((n, u) => n + (u.features?.fronts.filter((f) => f.kind === "door").length ?? 0), 0),
    drawerCount:     units.reduce((n, u) => n + (u.features?.fronts.filter((f) => f.kind === "drawer").length ?? 0), 0),
    ledStripCount:   units.filter((u) => u.role === "led_strip").length,
    tvRecessCount:   units.filter((u) => u.role === "opening").length,
    openShelfCount:  units.filter((u) => u.role === "open_shelf").length,
    shelfPanelCount: units.reduce((n, u) => n + (u.features?.shelves.length ?? 0), 0),
  };

  const opening = units.find((u) => u.role === "opening");
  const tvRecess: TvRecess | null = opening
    ? { widthMm: opening.width, heightMm: opening.height, posX: opening.posX, posY: opening.posY }
    : null;

  const maxHeightMm = units.length > 0
    ? Math.max(...units.map((u) => u.posY + u.height))
    : 0;

  const overall: CompiledOverall = {
    widthMm: roomLogic.suggestedRoomWidth,
    maxHeightMm,
    depthMm: roomLogic.suggestedRoomDepth,
    primaryFinish,
    roomType,
  };

  return { overall, summary, units, tvRecess };
}
