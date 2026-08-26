import { z } from "zod";
import type { ConstructionMethod } from "../../types/cabinet";

export type { ConstructionMethod };

export type JoineryKind =
  | "dado"
  | "rabbet"
  | "pocket_screw"
  | "shelf_pins"
  | "dowel"
  | "biscuit"
  | "confirmat"
  | "mortise_tenon";

export type OverlayKind = "full" | "partial" | "inset";

export interface ConstructionProfile {
  id: string;
  version: number;
  name?: string;

  method: ConstructionMethod;

  panelThicknessMm: number;
  backThicknessMm: number;
  doorThicknessMm: number;

  toeKick: {
    enabled: boolean;
    heightMm: number;
    depthMm: number;
  };

  reveals: {
    topMm: number;
    bottomMm: number;
    sidesMm: number;
    betweenFrontsMm: number;
  };

  overlay: {
    kind: OverlayKind;
    amountMm: number;
  };

  faceFrame?: {
    stileWidthMm: number;
    railWidthMm: number;
    thicknessMm: number;
  };

  joinery?: {
    carcass?: JoineryKind[];
    drawer?: JoineryKind[];
  };

  screwSystem?: string;

  boring?: {
    hingeInsetTopMm: number;
    hingeInsetBottomMm: number;
    hingeSpacingMm: number;
  };

  shelfPin?: {
    diameterMm: number;
    spacingMm: number;
    rowInsetMm: number;
    rows: number;
  };
}

export const constructionProfileSchema: z.ZodType<ConstructionProfile> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().optional(),

  method: z.enum(["frameless", "face_frame"]),

  panelThicknessMm: z.number().positive(),
  backThicknessMm: z.number().positive(),
  doorThicknessMm: z.number().positive(),

  toeKick: z.object({
    enabled: z.boolean(),
    heightMm: z.number().nonnegative(),
    depthMm: z.number().nonnegative(),
  }),

  reveals: z.object({
    topMm: z.number().nonnegative(),
    bottomMm: z.number().nonnegative(),
    sidesMm: z.number().nonnegative(),
    betweenFrontsMm: z.number().nonnegative(),
  }),

  overlay: z.object({
    kind: z.enum(["full", "partial", "inset"]),
    amountMm: z.number().nonnegative(),
  }),

  faceFrame: z
    .object({
      stileWidthMm: z.number().positive(),
      railWidthMm: z.number().positive(),
      thicknessMm: z.number().positive(),
    })
    .optional(),

  joinery: z
    .object({
      carcass: z
        .array(
          z.enum([
            "dado",
            "rabbet",
            "pocket_screw",
            "shelf_pins",
            "dowel",
            "biscuit",
            "confirmat",
            "mortise_tenon",
          ]),
        )
        .optional(),
      drawer: z
        .array(
          z.enum([
            "dado",
            "rabbet",
            "pocket_screw",
            "shelf_pins",
            "dowel",
            "biscuit",
            "confirmat",
            "mortise_tenon",
          ]),
        )
        .optional(),
    })
    .optional(),

  screwSystem: z.string().optional(),

  boring: z
    .object({
      hingeInsetTopMm: z.number().nonnegative(),
      hingeInsetBottomMm: z.number().nonnegative(),
      hingeSpacingMm: z.number().positive(),
    })
    .optional(),

  shelfPin: z
    .object({
      diameterMm: z.number().positive(),
      spacingMm: z.number().positive(),
      rowInsetMm: z.number().nonnegative(),
      rows: z.number().int().nonnegative(),
    })
    .optional(),
});

// ── Legacy compatibility profile factories ────────────────────────────────────
// These exist ONLY to feed legacy adapters and tests. They mirror the two
// divergent construction defaults observed in the STEP 1 audit — the TypeScript
// geometry compiler and the Python cad-service each ship with different values.
// Neither one is the canonical WoodCraft OS default; that decision is deferred
// to milestone V2.1 (Geometry Parity), where the values will be reconciled
// against verified real shop construction standards.

/**
 * Mirrors `packages/shared/src/types/geometry.ts` constants (89 mm toe kick,
 * 19 mm panel/door thickness). Use this ONLY when adapting cabinet designs
 * whose original construction assumptions matched the browser-side compiler.
 */
export function createLegacyVisualProfile(
  id: string = "legacy-visual",
  version: number = 1,
): ConstructionProfile {
  return {
    id,
    version,
    name: "Legacy Visual (TS geometry compiler)",
    method: "frameless",
    panelThicknessMm: 19,
    backThicknessMm: 19,
    doorThicknessMm: 19,
    toeKick: {
      enabled: true,
      heightMm: 89,
      depthMm: 76,
    },
    reveals: {
      topMm: 2,
      bottomMm: 2,
      sidesMm: 2,
      betweenFrontsMm: 2,
    },
    overlay: {
      kind: "full",
      amountMm: 0,
    },
  };
}

/**
 * Mirrors the Python cad-service defaults (96 mm toe kick, 18 mm panel/door
 * thickness, 6 mm HDF back, 30 mm drawer clearance). Use this ONLY when
 * adapting cabinet designs whose original construction assumptions matched the
 * server-side parametric generator.
 */
export function createLegacyCadProfile(
  id: string = "legacy-cad",
  version: number = 1,
): ConstructionProfile {
  return {
    id,
    version,
    name: "Legacy CAD (Python cad-service)",
    method: "frameless",
    panelThicknessMm: 18,
    backThicknessMm: 6,
    doorThicknessMm: 18,
    toeKick: {
      enabled: true,
      heightMm: 96,
      depthMm: 76,
    },
    reveals: {
      topMm: 2,
      bottomMm: 2,
      sidesMm: 2,
      betweenFrontsMm: 2,
    },
    overlay: {
      kind: "partial",
      amountMm: 3,
    },
    boring: {
      hingeInsetTopMm: 100,
      hingeInsetBottomMm: 100,
      hingeSpacingMm: 150,
    },
  };
}

/**
 * Legacy face-frame variant based on cad-service `parametric.py` defaults
 * (38 mm stile/rail, 19 mm thickness). Same caveat: this is legacy
 * compatibility only, not a canonical default.
 */
export function createLegacyFaceFrameProfile(
  id: string = "legacy-face-frame",
  version: number = 1,
): ConstructionProfile {
  return {
    id,
    version,
    name: "Legacy Face Frame (Python cad-service)",
    method: "face_frame",
    panelThicknessMm: 18,
    backThicknessMm: 6,
    doorThicknessMm: 18,
    toeKick: {
      enabled: true,
      heightMm: 96,
      depthMm: 76,
    },
    reveals: {
      topMm: 2,
      bottomMm: 2,
      sidesMm: 2,
      betweenFrontsMm: 2,
    },
    overlay: {
      kind: "partial",
      amountMm: 3,
    },
    faceFrame: {
      stileWidthMm: 38,
      railWidthMm: 38,
      thicknessMm: 19,
    },
  };
}
