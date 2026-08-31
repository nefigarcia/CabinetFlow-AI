import { aabbIntersects, getSceneAssetAabb, getSceneAssetClearanceAabb } from "./aabb";
import { getRoomBoundsViolations, ROOM_BOUNDS_VIOLATION_LABELS, type RoomBoundsMm, type RoomBoundsViolation } from "./room-bounds";
import type { SceneAssetDefinition } from "./scene-asset-definition";
import type { SceneAssetInstance } from "./scene-asset-instance";

// Spatial-validation orchestrator.
//
// Emits warnings-only (never blocking) for:
//   · out-of-bounds placement per direction
//   · asset ↔ asset AABB overlap
//   · clearance-envelope violation (asset intrudes into another asset's
//     declared clearance zone)
//
// Every issue is tagged `source: "scene"` so consumers can distinguish
// spatial validation from manufacturing or AI validation results.
//
// The engine is deterministic and metadata-driven — no AI, no random
// tolerances. Callers wanting live re-validation on drag should invoke
// this on transform commit (drag-end), not per frame.

export type SpatialValidationCode =
  | RoomBoundsViolation
  | "OVERLAPS_ASSET"
  | "CLEARANCE_VIOLATED";

export interface SpatialValidationIssue {
  code: SpatialValidationCode;
  /** Every spatial issue is a warning — Scene Assets never block CAD. */
  severity: "warning";
  /** Source tag lets the UI distinguish spatial vs manufacturing vs AI. */
  source: "scene";
  message: string;
  /** The other instance involved (populated for overlap / clearance issues). */
  targetInstanceId?: string;
}

/** Full context for validating a single instance. Pass `otherInstances`
 *  as the other assets IN THE SAME ROOM (already filtered by roomId). */
export interface ValidatePlacementInput {
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition;
  room: RoomBoundsMm;
  otherInstances: readonly SceneAssetInstance[];
  /** Lookup for other instances' definitions — same catalog store. */
  getDefinition: (assetDefinitionId: string) => SceneAssetDefinition | undefined;
}

/**
 * Runs every spatial check for a single instance and returns the flat
 * list of issues. Order is deterministic: room bounds first (by direction),
 * then overlap, then clearance.
 */
export function validateSceneAssetPlacement(
  input: ValidatePlacementInput,
): SpatialValidationIssue[] {
  const { instance, definition, room, otherInstances, getDefinition } = input;
  const issues: SpatialValidationIssue[] = [];

  const aabb = getSceneAssetAabb(instance, definition);

  // 1. Room bounds
  for (const v of getRoomBoundsViolations(aabb, room)) {
    issues.push({
      code: v,
      severity: "warning",
      source: "scene",
      message: ROOM_BOUNDS_VIOLATION_LABELS[v],
    });
  }

  // 2. Asset ↔ asset overlap + 3. clearance
  const collisionEnabled = definition.collision?.enabled !== false;
  if (collisionEnabled) {
    const myClearance = getSceneAssetClearanceAabb(instance, definition);

    for (const other of otherInstances) {
      if (other.id === instance.id) continue;
      const otherDef = getDefinition(other.assetDefinitionId);
      if (!otherDef) continue;
      if (otherDef.collision?.enabled === false) continue;

      const otherAabb = getSceneAssetAabb(other, otherDef);

      if (aabbIntersects(aabb, otherAabb)) {
        issues.push({
          code: "OVERLAPS_ASSET",
          severity: "warning",
          source: "scene",
          message: `Overlaps ${otherDef.name}`,
          targetInstanceId: other.id,
        });
        // Skip the clearance check for the same pair — a full overlap is
        // already flagged; a duplicate clearance warning would be noise.
        continue;
      }

      // Clearance: other asset intrudes into MY clearance envelope but
      // doesn't overlap my geometry.
      if (aabbIntersects(myClearance, otherAabb)) {
        issues.push({
          code: "CLEARANCE_VIOLATED",
          severity: "warning",
          source: "scene",
          message: `Clearance zone shared with ${otherDef.name}`,
          targetInstanceId: other.id,
        });
      }
    }
  }

  return issues;
}
