"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import {
  toSceneAssetDefinition,
  type SceneAssetDefinitionCreateInput,
  type SceneAssetDefinitionPatchInput,
  type SceneAssetDefinitionRecord,
  type SceneAssetDefinitionScope,
} from "@woodcraft/shared";

// Fetches DB-backed SceneAssetDefinitions and merges them into the
// existing Zustand store. The renderer + catalog panel don't know or
// care whether definitions came from the code catalog or the DB —
// they just consume `useSceneAssetsStore((s) => s.definitions)`.
//
// Two modes:
//   · `renderMode: true`  (default in the room workspace)
//     Fetches ACTIVE + ARCHIVED for the caller's tenancy. Both go into
//     the store so historic SceneAssetInstances referencing archived
//     definitions still resolve. The CatalogPanel filters
//     `active !== false` before rendering, so archived entries never
//     appear in the placeable list.
//   · `renderMode: false` (Asset Library management UI)
//     Fetches only active — the admin overview controls its own
//     archived/active toggle via the second-arg refetch.

export interface DefinitionListParams {
  scope?: SceneAssetDefinitionScope | "all";
  active?: "true" | "false" | "any";
  category?: string;
}

export interface UseSceneAssetDefinitionsOptions {
  /** When true, the initial fetch requests `active=any` so the store
   *  can hydrate archived-referenced instances. Default: true. */
  renderMode?: boolean;
}

export function useSceneAssetDefinitions(options: UseSceneAssetDefinitionsOptions = {}) {
  const renderMode = options.renderMode !== false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<SceneAssetDefinitionRecord[]>([]);
  const setDefinitions = useSceneAssetsStore((s) => s.setDefinitions);

  const refetch = useCallback(
    async (params: DefinitionListParams = {}) => {
      setLoading(true);
      setError(null);
      try {
        const search = new URLSearchParams();
        if (params.scope) search.set("scope", params.scope);
        if (params.active) search.set("active", params.active);
        if (params.category) search.set("category", params.category);
        const q = search.toString();
        const list = await apiClient.get<SceneAssetDefinitionRecord[]>(
          `/scene-asset-definitions${q ? `?${q}` : ""}`,
        );
        setRecords(list);
        // Merge into the renderer store, projecting each record into
        // the runtime SceneAssetDefinition shape. Archived rows land
        // in the store too — the CatalogPanel filters them out for
        // the placement UI while the renderer keeps resolving them
        // for existing instances.
        const runtime = list.map(toSceneAssetDefinition);
        setDefinitions(runtime);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [setDefinitions],
  );

  useEffect(() => {
    void refetch({
      scope: "all",
      active: renderMode ? "any" : "true",
    });
  }, [refetch, renderMode]);

  return { loading, error, records, refetch };
}

/** Uploads a new asset via multipart POST. The caller supplies the
 *  validated metadata + File objects; we serialize metadata as JSON and
 *  attach the files as multipart parts. */
export async function createSceneAssetDefinitionMultipart(input: {
  metadata: SceneAssetDefinitionCreateInput;
  model: File;
  thumbnail?: File | null;
  scope?: SceneAssetDefinitionScope;
}): Promise<{ record: SceneAssetDefinitionRecord; warnings: string[] }> {
  const form = new FormData();
  form.set("metadata", JSON.stringify(input.metadata));
  if (input.scope) form.set("scope", input.scope);
  form.set("model", input.model, input.model.name);
  if (input.thumbnail) form.set("thumbnail", input.thumbnail, input.thumbnail.name);
  return apiClient.postFile<{ record: SceneAssetDefinitionRecord; warnings: string[] }>(
    "/scene-asset-definitions",
    form,
  );
}

export async function patchSceneAssetDefinition(
  id: string,
  patch: SceneAssetDefinitionPatchInput,
): Promise<SceneAssetDefinitionRecord> {
  return apiClient.patch<SceneAssetDefinitionRecord>(`/scene-asset-definitions/${id}`, patch);
}

export async function archiveSceneAssetDefinition(
  id: string,
): Promise<{ archived: boolean; record: SceneAssetDefinitionRecord }> {
  return apiClient.delete<{ archived: boolean; record: SceneAssetDefinitionRecord }>(
    `/scene-asset-definitions/${id}`,
  );
}

export async function fetchSceneAssetUsage(id: string): Promise<{
  definitionId: string;
  slug: string | null;
  total: number;
  inMyOrganization: number;
  inOtherOrganizations: number | null;
}> {
  return apiClient.get(`/scene-asset-definitions/${id}/usage`);
}
