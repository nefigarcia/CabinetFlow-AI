import type { SceneAssetDefinition } from "./scene-asset-definition";
import type { SceneAssetInstance, Vec3 } from "./scene-asset-instance";
import { IDENTITY_SCALE } from "./scene-asset-instance";

// Effective dimensions for a scene-asset INSTANCE = catalog dimensions
// multiplied per axis by the instance's scale. Every consumer that
// wants "how big is this thing in the room right now" (collision,
// AABB, spatial validation, inspector display, dimension callouts)
// MUST use this helper — never do the multiplication inline. That way
// scale semantics stay in one place and axis-swap bugs (e.g. mixing
// scale.y with widthMm) become impossible.
//
// Both arguments are `Pick`ed so callers can pass reduced shapes
// (definition dimensions + instance scale) without dragging full
// records through pure-math call chains.

export interface EffectiveDimensionsMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

/** Multiplies each catalog axis by the matching instance scale. If the
 *  instance omits scale (legacy rows serialized before scale was
 *  editable), identity scale is assumed. */
export function getSceneAssetEffectiveDimensions(
  definition: Pick<SceneAssetDefinition, "dimensionsMm">,
  instance: Pick<SceneAssetInstance, "scale"> | { scale?: Vec3 } | null | undefined,
): EffectiveDimensionsMm {
  const scale = instance?.scale ?? IDENTITY_SCALE;
  return {
    widthMm: definition.dimensionsMm.widthMm * scale.x,
    heightMm: definition.dimensionsMm.heightMm * scale.y,
    depthMm: definition.dimensionsMm.depthMm * scale.z,
  };
}

/** True when the instance is materially resized from its catalog
 *  size on any axis. Used by the inspector to surface a "Resized from
 *  manufacturer dimensions" warning when a manufacturer/SKU is
 *  registered. Threshold defaults to 0.5% per axis — anything below
 *  is treated as floating-point noise from the round-trip through
 *  Prisma Decimal(10, 6). */
export function isInstanceScaled(
  instance: Pick<SceneAssetInstance, "scale"> | { scale?: Vec3 } | null | undefined,
  toleranceRel = 0.005,
): boolean {
  const scale = instance?.scale ?? IDENTITY_SCALE;
  return (
    Math.abs(scale.x - 1) > toleranceRel ||
    Math.abs(scale.y - 1) > toleranceRel ||
    Math.abs(scale.z - 1) > toleranceRel
  );
}
