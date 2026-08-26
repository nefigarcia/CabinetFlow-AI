// GeometryParitySnapshot — normalized cross-implementation cabinet geometry.
//
// The snapshot is intentionally schema-poor: only the physical facts that
// both a TypeScript compiler and a Python parametric engine can (or could)
// emit. Neither implementation is asked to change its native representation;
// each side has its own snapshot builder that mechanically translates its
// output into this shape.
//
// Comparing two snapshots is a deterministic per-field diff — see diff.ts.

import { z } from "zod";

export type SnapshotSource =
  | "typescript"
  | "python-predicted"
  | "python-live"
  | "physical_measurement";

export interface BoundingBoxMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export interface Vec3Mm {
  xMm: number;
  yMm: number;
  zMm: number;
}

/**
 * A structural part in the cut list (side panel, back, shelf, face frame,
 * drawer box, drawer front, door, toe kick). Emitted by whichever side
 * knows how to compute it.
 */
export interface SnapshotPart {
  role:
    | "left_panel"
    | "right_panel"
    | "top_panel"
    | "bottom_panel"
    | "back_panel"
    | "shelf"
    | "vertical_divider"
    | "horizontal_shelf"
    | "toe_kick"
    | "door"
    | "drawer_front"
    | "drawer_box_side"
    | "drawer_box_back"
    | "drawer_box_bottom"
    | "face_frame_stile"
    | "face_frame_rail"
    | "face_frame_mullion"
    | "sink_stretcher"
    | "blind_panel"
    | "custom";
  /** Human-readable name for the report. */
  name?: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  quantity: number;
  position?: Vec3Mm;
  /** Free-form tag map — e.g. `{ material: "hdf", drawerIndex: 2 }`. */
  tags?: Record<string, string | number>;
}

export interface SnapshotFront {
  kind: "door" | "drawer";
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  position?: Vec3Mm;
}

export interface SnapshotBoringPoint {
  role: "hinge_cup" | "shelf_pin" | "system_line";
  xMm: number;
  yMm: number;
  zMm?: number;
  diameterMm?: number;
  depthMm?: number;
}

export interface SnapshotToeKick {
  present: boolean;
  heightMm?: number;
  depthMm?: number;
}

export interface SnapshotCountertop {
  thicknessMm: number;
  frontOverhangMm: number;
  sideOverhangMm: number;
}

export interface SnapshotFaceFrame {
  stileWidthMm: number;
  railWidthMm: number;
  thicknessMm: number;
}

export interface SnapshotShelfPin {
  spacingMm: number;
  rowInsetMm: number;
  diameterMm: number;
}

export interface GeometryParitySnapshot {
  cabinetId: string;
  source: SnapshotSource;
  /** Copy of the fixture's declared cabinet type, for reporting. */
  cabinetType: string;
  units: "mm";

  boundingBox: BoundingBoxMm;

  parts: SnapshotPart[];

  features?: {
    toeKick?: SnapshotToeKick;
    fronts?: SnapshotFront[];
    countertop?: SnapshotCountertop | null;
    faceFrame?: SnapshotFaceFrame | null;
    boring?: SnapshotBoringPoint[];
    shelfPin?: SnapshotShelfPin;
  };

  /** Freeform diagnostic notes captured during snapshot generation. */
  notes?: string[];
}

// ── Zod schema ──────────────────────────────────────────────────────────────

const vec3Schema = z.object({
  xMm: z.number(),
  yMm: z.number(),
  zMm: z.number(),
});

const partSchema = z.object({
  role: z.enum([
    "left_panel",
    "right_panel",
    "top_panel",
    "bottom_panel",
    "back_panel",
    "shelf",
    "vertical_divider",
    "horizontal_shelf",
    "toe_kick",
    "door",
    "drawer_front",
    "drawer_box_side",
    "drawer_box_back",
    "drawer_box_bottom",
    "face_frame_stile",
    "face_frame_rail",
    "face_frame_mullion",
    "sink_stretcher",
    "blind_panel",
    "custom",
  ]),
  name: z.string().optional(),
  widthMm: z.number().nonnegative(),
  heightMm: z.number().nonnegative(),
  thicknessMm: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  position: vec3Schema.optional(),
  tags: z.record(z.union([z.string(), z.number()])).optional(),
});

export const geometryParitySnapshotSchema = z.object({
  cabinetId: z.string().min(1),
  source: z.enum([
    "typescript",
    "python-predicted",
    "python-live",
    "physical_measurement",
  ]),
  cabinetType: z.string(),
  units: z.literal("mm"),

  boundingBox: z.object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    depthMm: z.number().positive(),
  }),

  parts: z.array(partSchema),

  features: z
    .object({
      toeKick: z
        .object({
          present: z.boolean(),
          heightMm: z.number().nonnegative().optional(),
          depthMm: z.number().nonnegative().optional(),
        })
        .optional(),
      fronts: z
        .array(
          z.object({
            kind: z.enum(["door", "drawer"]),
            widthMm: z.number().nonnegative(),
            heightMm: z.number().nonnegative(),
            thicknessMm: z.number().nonnegative(),
            position: vec3Schema.optional(),
          }),
        )
        .optional(),
      countertop: z
        .union([
          z.object({
            thicknessMm: z.number().nonnegative(),
            frontOverhangMm: z.number().nonnegative(),
            sideOverhangMm: z.number().nonnegative(),
          }),
          z.null(),
        ])
        .optional(),
      faceFrame: z
        .union([
          z.object({
            stileWidthMm: z.number().nonnegative(),
            railWidthMm: z.number().nonnegative(),
            thicknessMm: z.number().nonnegative(),
          }),
          z.null(),
        ])
        .optional(),
      boring: z
        .array(
          z.object({
            role: z.enum(["hinge_cup", "shelf_pin", "system_line"]),
            xMm: z.number(),
            yMm: z.number(),
            zMm: z.number().optional(),
            diameterMm: z.number().nonnegative().optional(),
            depthMm: z.number().nonnegative().optional(),
          }),
        )
        .optional(),
      shelfPin: z
        .object({
          spacingMm: z.number().positive(),
          rowInsetMm: z.number().nonnegative(),
          diameterMm: z.number().positive(),
        })
        .optional(),
    })
    .optional(),

  notes: z.array(z.string()).optional(),
});

/** Deterministic canonical ordering used before comparing parts. */
export function sortSnapshotParts(parts: SnapshotPart[]): SnapshotPart[] {
  return [...parts].sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    if (a.widthMm !== b.widthMm) return a.widthMm - b.widthMm;
    if (a.heightMm !== b.heightMm) return a.heightMm - b.heightMm;
    if (a.thicknessMm !== b.thicknessMm) return a.thicknessMm - b.thicknessMm;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
