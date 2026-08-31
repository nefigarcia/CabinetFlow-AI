"use client";

import { useMemo } from "react";
import { filterInstancesForRoom } from "@woodcraft/shared";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useEditorStore } from "@/store/editor";
import { SceneAssetItem } from "./SceneAssetItem";

// The Scene Asset render layer. Mounted inside `DesignCanvas` next to
// (never inside) the cabinet map. Cabinet geometry stays on its own path.
//
// Only instances belonging to the currently-selected room render — the
// store holds instances across every room in the project. Filtering here
// (via the shared `filterInstancesForRoom` pure helper) keeps the render
// contract testable and prevents cross-room bleed.

interface Props {
  projectId: string;
}

export function SceneAssetLayer({ projectId }: Props) {
  const allInstances = useSceneAssetsStore((s) => s.instances);
  const definitions = useSceneAssetsStore((s) => s.definitions);
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);

  const instances = useMemo(
    () => filterInstancesForRoom(allInstances, selectedRoomId),
    [allInstances, selectedRoomId],
  );

  // Definition lookup — the catalog is tiny (~12 entries in Slice 2), so a
  // Map is more about clarity than performance.
  const definitionsById = useMemo(() => {
    const map = new Map<string, (typeof definitions)[number]>();
    for (const def of definitions) map.set(def.id, def);
    return map;
  }, [definitions]);

  return (
    <>
      {instances.map((instance) => {
        const definition = definitionsById.get(instance.assetDefinitionId);
        // Silent skip when the definition is missing — logging every miss
        // would spam the console for a stale reference; the layer is
        // best-effort by design.
        if (!definition) return null;
        return (
          <SceneAssetItem
            key={instance.id}
            projectId={projectId}
            instance={instance}
            definition={definition}
          />
        );
      })}
    </>
  );
}
