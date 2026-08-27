"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import type { SceneAssetInstance } from "@woodcraft/shared";

// Per-room hydration for Scene Asset instances. Mirrors `useRoomCabinets`
// exactly:
//   · Fires when the selected room changes.
//   · Replaces the entire store `instances` array with the current room's
//     server-persisted set. This matches the epic's Option A ("Store
//     current-room instances only") — consistent with how cabinets are
//     already hydrated in this codebase.
//   · A silent failure (e.g. network error) resets the store to [] so
//     the layer never shows stale instances from a previous room.

export function useRoomSceneAssets(projectId: string, roomId: string | null) {
  const setInstances = useSceneAssetsStore((s) => s.setInstances);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (rid: string) => {
      setLoading(true);
      try {
        const instances = await apiClient.get<SceneAssetInstance[]>(
          `/projects/${projectId}/rooms/${rid}/scene-assets`,
        );
        setInstances(instances);
      } catch {
        setInstances([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId, setInstances],
  );

  useEffect(() => {
    if (roomId) {
      void load(roomId);
    } else {
      setInstances([]);
    }
  }, [roomId, load, setInstances]);

  return { loading, reload: load };
}
