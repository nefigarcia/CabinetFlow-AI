// Pure state-transition helpers for Scene Asset selection.
//
// The store / React layers call these to decide what to do when workspace
// state changes. Keeping the decisions here makes the rules testable
// without a browser or a store instance.

/** Decision the caller must apply to `selectedSceneAssetId` after a room switch. */
export type SceneAssetSelectionDecision = "keep" | "clear";

/**
 * When the currently-selected room changes, decides whether the previously
 * selected scene-asset instance should stay selected.
 *
 * Rules:
 *   · No new room → clear (nothing valid can be selected in "no room")
 *   · Selection's roomId unknown → clear (can't prove it belongs)
 *   · Selection's roomId equals the new room → keep
 *   · Otherwise → clear (asset lives in a different room)
 *
 * `selectedInstanceRoomId` is `undefined` when there is no current scene-
 * asset selection or when the selection references an id that no longer
 * exists in the store. Both cases collapse to "clear" — no-op if selection
 * was already null.
 */
export function sceneAssetSelectionAfterRoomChange(
  selectedInstanceRoomId: string | undefined,
  newRoomId: string | null,
): SceneAssetSelectionDecision {
  if (newRoomId == null) return "clear";
  if (selectedInstanceRoomId == null) return "clear";
  return selectedInstanceRoomId === newRoomId ? "keep" : "clear";
}
