import { z } from "zod";

// Placement constraints declaring where an asset can be positioned.
// Multiple mounting kinds may be true (e.g. a pendant is ceilingMounted;
// a bathtub is floorMounted; a wall sconce is wallMounted).
//
// A definition with no `placement` metadata defaults to `floorMounted`,
// which matches the most common furniture/appliance case.

export interface SceneAssetPlacement {
  floorMounted?: boolean;
  wallMounted?: boolean;
  ceilingMounted?: boolean;
  countertopMounted?: boolean;
}

export const sceneAssetPlacementSchema: z.ZodType<SceneAssetPlacement> = z.object({
  floorMounted: z.boolean().optional(),
  wallMounted: z.boolean().optional(),
  ceilingMounted: z.boolean().optional(),
  countertopMounted: z.boolean().optional(),
});

/** Default placement policy applied when a definition omits `placement`. */
export const DEFAULT_PLACEMENT: SceneAssetPlacement = { floorMounted: true };

/** True when the asset can rest on the floor (default when unset). */
export function isFloorMounted(placement: SceneAssetPlacement | undefined): boolean {
  const p = placement ?? DEFAULT_PLACEMENT;
  return p.floorMounted === true;
}

/** True when the asset should be attached to a wall. */
export function isWallMounted(placement: SceneAssetPlacement | undefined): boolean {
  return placement?.wallMounted === true;
}

/** True when the asset hangs from the ceiling (pendants, chandeliers). */
export function isCeilingMounted(placement: SceneAssetPlacement | undefined): boolean {
  return placement?.ceilingMounted === true;
}

/** True when the asset sits on a countertop (small appliances, decor). */
export function isCountertopMounted(placement: SceneAssetPlacement | undefined): boolean {
  return placement?.countertopMounted === true;
}
