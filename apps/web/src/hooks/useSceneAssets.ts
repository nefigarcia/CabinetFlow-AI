"use client";

import { useCallback, useState } from "react";
import { ApiError, apiClient } from "@/lib/api";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import type {
  SceneAssetInstance,
  SceneAssetInstanceCreateInput,
  SceneAssetInstanceUpdateInput,
} from "@woodcraft/shared";

export { ApiError };

// Scene Asset CRUD hook — mirrors `useCabinets` conventions:
//   · scoped to a specific project (`projectId` from route)
//   · draws the current room id from the editor store
//   · optimistic behavior lives in the store layer
//   · surfaces `saving` for the inspector's status text
//
// Every call is guarded on `selectedRoomId` — no scene-asset write can
// happen without a current room. Persistence uses the same `apiClient`
// (JWT auth, refresh, base URL) as every other feature.

export function useSceneAssets(projectId: string) {
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  const selectSceneAsset = useEditorStore((s) => s.selectSceneAsset);
  const addInstance = useSceneAssetsStore((s) => s.addInstance);
  const updateInstance = useSceneAssetsStore((s) => s.updateInstance);
  const removeInstance = useSceneAssetsStore((s) => s.removeInstance);
  const [saving, setSaving] = useState(false);

  const baseUrl = (instanceId?: string) => {
    const base = `/projects/${projectId}/rooms/${selectedRoomId}/scene-assets`;
    return instanceId ? `${base}/${instanceId}` : base;
  };

  /**
   * POST — creates a persistent instance. Adds the server-returned
   * instance to the store and returns it. THROWS on failure so the
   * caller can distinguish domain errors (ApiError with a real
   * message) from network failures (generic error). Returns null ONLY
   * when there's no selected room — a caller-side precondition, not a
   * server-side failure.
   */
  const create = useCallback(
    async (data: SceneAssetInstanceCreateInput): Promise<SceneAssetInstance | null> => {
      if (!selectedRoomId) return null;
      setSaving(true);
      try {
        const instance = await apiClient.post<SceneAssetInstance>(baseUrl(), data);
        addInstance(instance);
        return instance;
      } finally {
        setSaving(false);
      }
    },
    [selectedRoomId, projectId, addInstance],
  );

  /** PATCH — persists the given patch. The store was already updated
   *  optimistically by the caller (Inspector); this replaces the local
   *  version with the authoritative server response. */
  const save = useCallback(
    async (
      instanceId: string,
      patch: SceneAssetInstanceUpdateInput,
    ): Promise<SceneAssetInstance | null> => {
      if (!selectedRoomId) return null;
      setSaving(true);
      try {
        const updated = await apiClient.patch<SceneAssetInstance>(
          baseUrl(instanceId),
          patch,
        );
        // Replace with server version — timestamps and canonical shape.
        updateInstance(instanceId, {
          positionMm: updated.positionMm,
          rotationDeg: updated.rotationDeg,
          scale: updated.scale,
          visible: updated.visible,
          placement: updated.placement,
          materialOverrides: updated.materialOverrides,
        });
        return updated;
      } catch (e: unknown) {
        console.error("Save scene asset failed:", e);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [selectedRoomId, projectId, updateInstance],
  );

  /** DELETE — API-first: only remove from the store after the server
   *  confirms deletion. Clears selection if the deleted instance was
   *  currently selected. */
  const remove = useCallback(
    async (instanceId: string): Promise<boolean> => {
      if (!selectedRoomId) return false;
      try {
        await apiClient.delete(baseUrl(instanceId));
        removeInstance(instanceId);
        const currentSel = useEditorStore.getState().selectedSceneAssetId;
        if (currentSel === instanceId) selectSceneAsset(null);
        return true;
      } catch (e: unknown) {
        console.error("Delete scene asset failed:", e);
        return false;
      }
    },
    [selectedRoomId, projectId, removeInstance, selectSceneAsset],
  );

  return { saving, create, save, remove };
}
