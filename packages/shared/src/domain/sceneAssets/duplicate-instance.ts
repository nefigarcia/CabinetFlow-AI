import type {
  SceneAssetInstance,
  SceneAssetInstanceCreateInput,
} from "./scene-asset-instance";

// Pure duplicate helper for a SceneAssetInstance.
//
// Returns a CREATE INPUT (the POST payload for the API), not a full
// persisted instance — server owns id + timestamps + tenancy. The web
// layer composes this with `apiClient.post(...)`; the response comes back
// with the server-assigned cuid and canonical shape.
//
// Rules (per Slice 6):
//   · same assetDefinitionId, rotation, visibility, materialOverrides
//   · position offset +200 mm on X by default (overridable)
//   · scale is intentionally NOT carried through — MVP keeps instances at
//     identity scale server-side
//   · SOURCE INSTANCE IS NEVER MUTATED

export const DEFAULT_DUPLICATE_OFFSET_MM_X = 200;

export interface DuplicateInstanceOptions {
  /** Override the default 200 mm X offset (e.g. 0 for a stacked duplicate). */
  offsetMmX?: number;
}

/** Fields required from the source instance to compute a duplicate. */
type DuplicateSource = Pick<
  SceneAssetInstance,
  "assetDefinitionId" | "positionMm" | "rotationDeg" | "visible" | "materialOverrides"
>;

export function duplicateSceneAssetInstance(
  source: DuplicateSource,
  options: DuplicateInstanceOptions = {},
): SceneAssetInstanceCreateInput {
  const offset = options.offsetMmX ?? DEFAULT_DUPLICATE_OFFSET_MM_X;

  return {
    assetDefinitionId: source.assetDefinitionId,
    positionMm: {
      x: source.positionMm.x + offset,
      y: source.positionMm.y,
      z: source.positionMm.z,
    },
    // Rotation + overrides: shallow-clone so later mutation of the
    // duplicate does not leak back into the source.
    rotationDeg: { ...source.rotationDeg },
    visible: source.visible,
    materialOverrides: source.materialOverrides
      ? { ...source.materialOverrides }
      : undefined,
  };
}
