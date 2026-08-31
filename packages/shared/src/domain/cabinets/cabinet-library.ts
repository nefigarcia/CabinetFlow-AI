import type { CabinetType } from "../../types/cabinet";

// Cabinet library — categorization + defaults + width presets.
//
// This module owns the LIBRARY view of cabinet types (how the catalog is
// organized in the UI) WITHOUT introducing a parallel type system. Every
// entry references an existing `CabinetType` string from the domain.
//
// Widths are millimeters (domain rule). Presets cover common European
// and North-American cabinet widths; unit conversion for display lives
// at the UI boundary.

export const CABINET_CATEGORIES = [
  "base",
  "wall",
  "tall",
  "drawer",
  "sink",
  "corner",
  "appliance",
  "open",
  "custom",
] as const;

export type CabinetCategory = (typeof CABINET_CATEGORIES)[number];

export interface CabinetLibraryEntry {
  /** Stable id — used by the UI to render + persist recently-used. */
  id: string;
  /** Which CabinetType this entry produces. */
  type: CabinetType;
  category: CabinetCategory;
  name: string;
  description: string;
  /** Default dimensions applied when the entry is placed. Overridable
   *  in the create dialog. */
  defaultWidthMm: number;
  defaultHeightMm: number;
  defaultDepthMm: number;
  /** Common width presets shown in the quick-add flow. Custom is always
   *  available as a numeric input regardless of what's listed here. */
  widthPresetsMm: readonly number[];
}

/** Standard European cabinet widths (mm). Also cover most NA metric
 *  kitchens. */
const EU_STANDARD_WIDTHS = [300, 400, 450, 500, 600, 750, 800, 900, 1000, 1200] as const;
const DRAWER_WIDTHS = [400, 450, 500, 600, 800, 900] as const;
const SINK_WIDTHS = [600, 750, 800, 900] as const;
const APPLIANCE_WIDTHS = [600, 750, 900] as const;
const TALL_WIDTHS = [450, 600, 750, 900] as const;
const CORNER_WIDTHS = [900, 1000, 1200] as const;

export const CABINET_LIBRARY: readonly CabinetLibraryEntry[] = [
  {
    id: "base-standard",
    type: "base",
    category: "base",
    name: "Base cabinet",
    description: "Floor-mounted carcass, one or two doors, adjustable shelf.",
    defaultWidthMm: 600,
    defaultHeightMm: 720,
    defaultDepthMm: 560,
    widthPresetsMm: EU_STANDARD_WIDTHS,
  },
  {
    id: "drawer-base",
    type: "drawer_base",
    category: "drawer",
    name: "Drawer base",
    description: "Base cabinet with a drawer bank (3-4 drawers by default).",
    defaultWidthMm: 600,
    defaultHeightMm: 720,
    defaultDepthMm: 560,
    widthPresetsMm: DRAWER_WIDTHS,
  },
  {
    id: "sink-base",
    type: "sink_base",
    category: "sink",
    name: "Sink base",
    description: "Base cabinet reinforced for a drop-in or undermount sink.",
    defaultWidthMm: 900,
    defaultHeightMm: 720,
    defaultDepthMm: 560,
    widthPresetsMm: SINK_WIDTHS,
  },
  {
    id: "wall-standard",
    type: "wall",
    category: "wall",
    name: "Wall cabinet",
    description: "Mounted above counter — install height set by wall placement.",
    defaultWidthMm: 600,
    defaultHeightMm: 720,
    defaultDepthMm: 320,
    widthPresetsMm: EU_STANDARD_WIDTHS,
  },
  {
    id: "tall-pantry",
    type: "tall",
    category: "tall",
    name: "Tall pantry",
    description: "Full-height cabinet — pantry, broom, or utility.",
    defaultWidthMm: 600,
    defaultHeightMm: 2100,
    defaultDepthMm: 560,
    widthPresetsMm: TALL_WIDTHS,
  },
  {
    id: "corner-l",
    type: "corner",
    category: "corner",
    name: "L-shaped corner",
    description: "Corner carcass with a blind side or L-return.",
    defaultWidthMm: 900,
    defaultHeightMm: 720,
    defaultDepthMm: 900,
    widthPresetsMm: CORNER_WIDTHS,
  },
  {
    id: "appliance-gap",
    type: "base",
    category: "appliance",
    name: "Appliance gap",
    description:
      "Placeholder for a freestanding appliance (range, refrigerator). Creates an intentional gap — no manufactured parts.",
    defaultWidthMm: 900,
    defaultHeightMm: 720,
    defaultDepthMm: 600,
    widthPresetsMm: APPLIANCE_WIDTHS,
  },
  {
    id: "island-base",
    type: "island",
    category: "base",
    name: "Island base",
    description: "Freestanding base — not wall-attached by default.",
    defaultWidthMm: 1200,
    defaultHeightMm: 900,
    defaultDepthMm: 800,
    widthPresetsMm: [900, 1200, 1500, 1800, 2100],
  },
] as const;

/** Deterministic lookup — never throws; returns undefined for unknown ids. */
export function getCabinetLibraryEntry(id: string): CabinetLibraryEntry | undefined {
  return CABINET_LIBRARY.find((e) => e.id === id);
}

export function filterLibraryByCategory(
  entries: readonly CabinetLibraryEntry[],
  category: CabinetCategory | "all",
): CabinetLibraryEntry[] {
  if (category === "all") return entries.slice();
  return entries.filter((e) => e.category === category);
}

export function searchLibrary(
  entries: readonly CabinetLibraryEntry[],
  query: string,
): CabinetLibraryEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return entries.slice();
  return entries.filter(
    (e) =>
      e.id.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q),
  );
}

/** Union of standard widths across every entry. Useful for shared
 *  presets in a compact UI. */
export function getUnionOfWidthPresets(): number[] {
  const s = new Set<number>();
  for (const e of CABINET_LIBRARY) for (const w of e.widthPresetsMm) s.add(w);
  return Array.from(s).sort((a, b) => a - b);
}
