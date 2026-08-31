import type { SceneAssetInstance } from "./scene-asset-instance";

// Pure per-room filter for a list of SceneAssetInstances.
//
// The store holds instances for every room; the render layer + inspector
// must only see instances belonging to the currently-selected room, or
// nothing at all when no room is selected. Kept as a pure helper so the
// filter contract is testable independent of Zustand / React.

/** Returns the subset of `instances` that belong to `roomId`.
 *  If `roomId` is `null`/`undefined`, returns an empty array — no room, no assets. */
export function filterInstancesForRoom(
  instances: readonly SceneAssetInstance[],
  roomId: string | null | undefined,
): SceneAssetInstance[] {
  if (!roomId) return [];
  return instances.filter((i) => i.roomId === roomId);
}
