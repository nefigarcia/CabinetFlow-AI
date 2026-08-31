import { z } from "zod";

// Collision / clearance envelope for a Scene Asset.
//
// Clearances describe the MINIMUM empty space that should be preserved
// around the object for it to function — e.g. a refrigerator needs rear
// space for airflow and front space for the door swing. Numbers are
// millimeters, aligned with the rest of the domain.
//
// When `enabled` is false, the asset is skipped by broad-phase collision
// checks entirely (useful for rugs and other flat decor).

export interface SceneAssetCollision {
  enabled: boolean;
  clearanceFrontMm?: number;
  clearanceBackMm?: number;
  clearanceLeftMm?: number;
  clearanceRightMm?: number;
  clearanceTopMm?: number;
}

export const sceneAssetCollisionSchema: z.ZodType<SceneAssetCollision> = z.object({
  enabled: z.boolean(),
  clearanceFrontMm: z.number().nonnegative().optional(),
  clearanceBackMm: z.number().nonnegative().optional(),
  clearanceLeftMm: z.number().nonnegative().optional(),
  clearanceRightMm: z.number().nonnegative().optional(),
  clearanceTopMm: z.number().nonnegative().optional(),
});

/** Default: collision enabled, no additional clearance. */
export const DEFAULT_COLLISION: SceneAssetCollision = { enabled: true };
