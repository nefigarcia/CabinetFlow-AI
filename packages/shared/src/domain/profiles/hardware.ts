import { z } from "zod";

export interface HingeSpec {
  type: string;
  boring?: {
    cupDiameterMm: number;
    cupDepthMm: number;
    cupInsetMm: number;
  };
  requiredClearanceMm?: number;
}

export interface DrawerSlideSpec {
  type: string;
  sideClearanceMm: number;
  bottomClearanceMm?: number;
  lengthIncrementMm?: number;
}

export interface ShelfPinHardwareSpec {
  type: string;
  diameterMm: number;
  minEdgeDistanceMm?: number;
}

export interface PullSpec {
  type: "pull" | "knob";
  style?: string;
  lengthMm?: number;
  mounting?: {
    holeSpacingMm?: number;
    holeDiameterMm?: number;
  };
}

export interface HardwareProfile {
  id: string;
  version: number;
  name?: string;

  hinge?: HingeSpec;
  drawerSlide?: DrawerSlideSpec;
  shelfPin?: ShelfPinHardwareSpec;
  pulls?: PullSpec[];
}

export const hardwareProfileSchema: z.ZodType<HardwareProfile> = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().optional(),

  hinge: z
    .object({
      type: z.string(),
      boring: z
        .object({
          cupDiameterMm: z.number().positive(),
          cupDepthMm: z.number().positive(),
          cupInsetMm: z.number().nonnegative(),
        })
        .optional(),
      requiredClearanceMm: z.number().nonnegative().optional(),
    })
    .optional(),

  drawerSlide: z
    .object({
      type: z.string(),
      sideClearanceMm: z.number().nonnegative(),
      bottomClearanceMm: z.number().nonnegative().optional(),
      lengthIncrementMm: z.number().positive().optional(),
    })
    .optional(),

  shelfPin: z
    .object({
      type: z.string(),
      diameterMm: z.number().positive(),
      minEdgeDistanceMm: z.number().nonnegative().optional(),
    })
    .optional(),

  pulls: z
    .array(
      z.object({
        type: z.enum(["pull", "knob"]),
        style: z.string().optional(),
        lengthMm: z.number().positive().optional(),
        mounting: z
          .object({
            holeSpacingMm: z.number().nonnegative().optional(),
            holeDiameterMm: z.number().nonnegative().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});
