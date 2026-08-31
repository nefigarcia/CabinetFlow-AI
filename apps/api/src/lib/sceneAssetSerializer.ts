import type { SceneAssetInstance as PrismaSceneAssetInstance } from "@woodcraft/db";
import type {
  SceneAssetInstance,
  SceneAssetInstancePlacement,
} from "@woodcraft/shared";

// Single serializer for GET / POST / PATCH responses — every scene-asset
// route returns the same JSON shape, matching the shared
// `SceneAssetInstance` type. Converts Prisma `Decimal` columns to plain
// numbers (per the existing cabinet convention — see
// `apps/api/src/app/api/projects/[id]/rooms/[roomId]/cabinets/route.ts`).
//
// Prisma `Json?` columns are already deserialized by Prisma Client into
// JS objects/values, so materialOverrides passes through as-is (narrowed
// to Record<string, string> at the type boundary — we validate on write).

export function serializeSceneAssetInstance(
  row: PrismaSceneAssetInstance,
): SceneAssetInstance {
  const materialOverrides =
    row.materialOverrides && typeof row.materialOverrides === "object" && !Array.isArray(row.materialOverrides)
      ? (row.materialOverrides as Record<string, string>)
      : undefined;

  return {
    id: row.id,
    orgId: row.orgId,
    roomId: row.roomId,
    assetDefinitionId: row.assetDefinitionId,
    positionMm: {
      x: Number(row.posX),
      y: Number(row.posY),
      z: Number(row.posZ),
    },
    rotationDeg: {
      x: Number(row.rotX),
      y: Number(row.rotY),
      z: Number(row.rotZ),
    },
    scale: {
      x: Number(row.scaleX),
      y: Number(row.scaleY),
      z: Number(row.scaleZ),
    },
    visible: row.visible,
    placement: hydratePlacement(row),
    materialOverrides,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Column-level → domain-shape adapter. Rows saved before the 0002
 *  migration land here with `placementMode = "free"` (default) and all
 *  `wall*` NULL, and hydrate to `{ mode: "free" }`. A row saved with
 *  `placementMode = "wall"` but any wall_* NULL is treated defensively
 *  as free (matches `normalizeInstancePlacement`). */
function hydratePlacement(
  row: Pick<
    PrismaSceneAssetInstance,
    "placementMode" | "wallId" | "wallLocalX" | "wallLocalY" | "wallLocalZ"
  >,
): SceneAssetInstancePlacement {
  if (row.placementMode !== "wall") return { mode: "free" };
  if (
    row.wallId == null ||
    row.wallLocalX == null ||
    row.wallLocalY == null ||
    row.wallLocalZ == null
  ) {
    return { mode: "free" };
  }
  return {
    mode: "wall",
    wall: {
      wallId: row.wallId,
      localPositionMm: {
        x: Number(row.wallLocalX),
        y: Number(row.wallLocalY),
        z: Number(row.wallLocalZ),
      },
    },
  };
}

/** Domain-shape → column-level adapter. Used by POST/PATCH handlers to
 *  build the Prisma write payload. `{ mode: "free" }` (default) explicitly
 *  nulls the wall columns so a detach operation persists correctly. */
export function placementToColumns(
  placement: SceneAssetInstancePlacement | undefined,
): {
  placementMode: string;
  wallId: string | null;
  wallLocalX: number | null;
  wallLocalY: number | null;
  wallLocalZ: number | null;
} {
  if (placement?.mode === "wall" && placement.wall) {
    return {
      placementMode: "wall",
      wallId: placement.wall.wallId,
      wallLocalX: placement.wall.localPositionMm.x,
      wallLocalY: placement.wall.localPositionMm.y,
      wallLocalZ: placement.wall.localPositionMm.z,
    };
  }
  return {
    placementMode: "free",
    wallId: null,
    wallLocalX: null,
    wallLocalY: null,
    wallLocalZ: null,
  };
}
