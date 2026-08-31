import type { Room } from "../../types/project";
import type { SceneAssetDefinition } from "./scene-asset-definition";
import type { Vec3 } from "./scene-asset-instance";
import { IDENTITY_ROTATION } from "./scene-asset-instance";
import { DEFAULT_PLACEMENT } from "./scene-asset-placement";

// Deterministic default placement for a Scene Asset instance being freshly
// added to a room.
//
// Returns coordinates in DOMAIN space:
//   · position in millimeters
//   · rotation in degrees
//   · scene-asset anchor = BOTTOM-CENTER (Y=0 → resting on the floor)
//
// The helper is intentionally coarse — it picks a sensible center-of-room
// spawn point and reports oversized-asset warnings, but does NOT implement
// collision, wall snapping, countertop snapping, or ceiling placement.
// Those land in Slices 8–9.

export type PlacementWarningCode =
  | "ASSET_WIDER_THAN_ROOM"
  | "ASSET_DEEPER_THAN_ROOM"
  | "ASSET_TALLER_THAN_ROOM"
  | "WALL_MOUNT_NOT_IMPLEMENTED"
  | "CEILING_MOUNT_NOT_IMPLEMENTED"
  | "COUNTERTOP_MOUNT_NOT_IMPLEMENTED";

export interface PlacementWarning {
  code: PlacementWarningCode;
  message: string;
}

export interface PlacementTransform {
  positionMm: Vec3;
  rotationDeg: Vec3;
}

export interface PlacementResult {
  transform: PlacementTransform;
  warnings: PlacementWarning[];
}

export interface GetDefaultPlacementInput {
  room: Pick<Room, "width" | "height" | "depth"> | null | undefined;
  definition: SceneAssetDefinition;
}

/**
 * Computes a deterministic default placement for a definition inside a
 * room. Returns the transform plus any warnings the caller should surface.
 *
 * When `room` is null/undefined the helper returns `(0, 0, 0)` — the
 * caller is expected to prevent placement in that case (no active room →
 * no legal target).
 */
export function getDefaultSceneAssetPlacement(
  input: GetDefaultPlacementInput,
): PlacementResult {
  const { room, definition } = input;
  const warnings: PlacementWarning[] = [];

  const placement = definition.placement ?? DEFAULT_PLACEMENT;

  // No active room — nothing to center against. Return origin so the
  // caller sees a defined transform, but this branch is generally guarded
  // out by the UI (which should require a selected room before placement).
  if (!room) {
    return {
      transform: {
        positionMm: { x: 0, y: 0, z: 0 },
        rotationDeg: { ...IDENTITY_ROTATION },
      },
      warnings,
    };
  }

  // Room dimensions on the current model are Decimal; every consumer
  // (Prisma runtime included) surfaces them here as JS `number` millimeters.
  const roomW = Number(room.width);
  const roomD = Number(room.depth);
  const roomH = Number(room.height);

  const assetW = definition.dimensionsMm.widthMm;
  const assetD = definition.dimensionsMm.depthMm;
  const assetH = definition.dimensionsMm.heightMm;

  if (assetW > roomW) {
    warnings.push({
      code: "ASSET_WIDER_THAN_ROOM",
      message: `Asset is ${assetW} mm wide; room is only ${roomW} mm wide.`,
    });
  }
  if (assetD > roomD) {
    warnings.push({
      code: "ASSET_DEEPER_THAN_ROOM",
      message: `Asset is ${assetD} mm deep; room is only ${roomD} mm deep.`,
    });
  }
  if (assetH > roomH) {
    warnings.push({
      code: "ASSET_TALLER_THAN_ROOM",
      message: `Asset is ${assetH} mm tall; room is only ${roomH} mm tall.`,
    });
  }

  // Deterministic center-of-floor spawn. Bottom-center anchor → Y=0 sits
  // the asset on the floor. Wall / ceiling / countertop snapping is
  // deliberately deferred — we surface an honest warning instead of
  // pretending to place correctly.
  const positionMm: Vec3 = {
    x: roomW / 2,
    y: 0,
    z: roomD / 2,
  };

  if (placement.wallMounted && !placement.floorMounted) {
    warnings.push({
      code: "WALL_MOUNT_NOT_IMPLEMENTED",
      message:
        "Wall snapping is not implemented; asset placed at room center.",
    });
  }
  if (placement.ceilingMounted && !placement.floorMounted) {
    warnings.push({
      code: "CEILING_MOUNT_NOT_IMPLEMENTED",
      message:
        "Ceiling placement is not implemented; asset placed at room center.",
    });
  }
  if (placement.countertopMounted && !placement.floorMounted) {
    warnings.push({
      code: "COUNTERTOP_MOUNT_NOT_IMPLEMENTED",
      message:
        "Countertop snapping is not implemented; asset placed at room center.",
    });
  }

  return {
    transform: {
      positionMm,
      rotationDeg: { ...IDENTITY_ROTATION },
    },
    warnings,
  };
}
