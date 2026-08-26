import { z } from "zod";
import type { GrainDirection } from "../../types/cabinet";

export type { GrainDirection };

export type MaterialType =
  | "plywood"
  | "mdf"
  | "hdf"
  | "solid_wood"
  | "melamine"
  | "laminate"
  | "particleboard"
  | "veneer_core";

export interface EdgeBandingRule {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  material?: string;
  thicknessMm?: number;
}

export interface FinishSpec {
  kind?: string;
  sheen?: string;
  color?: string;
}

export interface ManufacturerRef {
  name?: string;
  supplier?: string;
  sku?: string;
}

export interface MaterialProfile {
  id: string;
  version: number;
  name?: string;

  materialType: MaterialType;
  thicknessMm: number;

  grainDirection: GrainDirection;

  edgeBanding?: EdgeBandingRule;

  finish?: FinishSpec;
  color?: string;

  densityKgPerM3?: number;

  manufacturer?: ManufacturerRef;
}

export const materialProfileSchema: z.ZodType<MaterialProfile> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().optional(),

  materialType: z.enum([
    "plywood",
    "mdf",
    "hdf",
    "solid_wood",
    "melamine",
    "laminate",
    "particleboard",
    "veneer_core",
  ]),
  thicknessMm: z.number().positive(),

  grainDirection: z.enum(["horizontal", "vertical", "none"]),

  edgeBanding: z
    .object({
      top: z.boolean().optional(),
      bottom: z.boolean().optional(),
      left: z.boolean().optional(),
      right: z.boolean().optional(),
      material: z.string().optional(),
      thicknessMm: z.number().nonnegative().optional(),
    })
    .optional(),

  finish: z
    .object({
      kind: z.string().optional(),
      sheen: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),

  color: z.string().optional(),

  densityKgPerM3: z.number().positive().optional(),

  manufacturer: z
    .object({
      name: z.string().optional(),
      supplier: z.string().optional(),
      sku: z.string().optional(),
    })
    .optional(),
});
