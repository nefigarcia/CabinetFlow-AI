import { create } from "zustand";
import {
  addInstance,
  clearInstances,
  DEFAULT_SCENE_ASSET_CATALOG,
  removeInstance,
  updateInstance,
  type SceneAssetDefinition,
  type SceneAssetInstance,
  type SceneAssetInstancePatch,
} from "@woodcraft/shared";

// Scene Asset store.
//
// Kept SEPARATE from the cabinet-focused `useEditorStore` (per the epic's
// "do not blindly grow editor.ts into a large mixed-object store" rule).
//
// Holds ONLY serializable data — no THREE.Object3D, no THREE.Material, no
// GLTF scene refs, no mutable scene handles. The renderer resolves those
// live from the asset loader (Slice 7).
//
// CRUD actions delegate to the pure reducers in `@woodcraft/shared/domain/
// sceneAssets` so mutation semantics live in one testable place.

interface SceneAssetsState {
  definitions: SceneAssetDefinition[];
  instances: SceneAssetInstance[];

  setDefinitions(definitions: SceneAssetDefinition[]): void;

  setInstances(instances: SceneAssetInstance[]): void;
  addInstance(instance: SceneAssetInstance): void;
  updateInstance(id: string, patch: SceneAssetInstancePatch): void;
  removeInstance(id: string): void;
  clearInstances(): void;
}

export const useSceneAssetsStore = create<SceneAssetsState>((set) => ({
  // Seeded from the bootstrap catalog. Later slices swap this for a
  // server-fetched catalog via `setDefinitions`.
  definitions: [...DEFAULT_SCENE_ASSET_CATALOG],
  instances: [],

  setDefinitions: (definitions) => set({ definitions }),

  setInstances: (instances) => set({ instances }),
  addInstance: (instance) =>
    set((state) => ({ instances: addInstance(state.instances, instance) })),
  updateInstance: (id, patch) =>
    set((state) => ({ instances: updateInstance(state.instances, id, patch) })),
  removeInstance: (id) =>
    set((state) => ({ instances: removeInstance(state.instances, id) })),
  clearInstances: () => set({ instances: clearInstances() }),
}));
