import type { SceneAssetInstance } from "./scene-asset-instance";

// Pure reducer functions for a list of SceneAssetInstances.
//
// The web-side Zustand store composes these into store actions so all
// mutation semantics live in one testable place, independent of the state
// container. Every reducer is IMMUTABLE — returns a new array/instance
// without mutating the input.

/** Appends an instance. Callers must ensure `instance.id` is unique. */
export function addInstance(
  list: SceneAssetInstance[],
  instance: SceneAssetInstance,
): SceneAssetInstance[] {
  return [...list, instance];
}

/** Removes the instance with the given id. No-op when absent. */
export function removeInstance(
  list: SceneAssetInstance[],
  id: string,
): SceneAssetInstance[] {
  return list.filter((i) => i.id !== id);
}

/**
 * Fields of `SceneAssetInstance` that a client is allowed to update.
 * `orgId` / `projectId` / `roomId` are tenancy-critical and are never
 * mutated after creation; `id` / `createdAt` are immutable.
 */
export type SceneAssetInstancePatch = Partial<
  Pick<
    SceneAssetInstance,
    "positionMm" | "rotationDeg" | "scale" | "visible" | "materialOverrides"
  >
>;

/**
 * Applies a patch to the instance with the given id. Refreshes `updatedAt`
 * from the provided clock (defaults to `new Date().toISOString()` — tests
 * pass a deterministic clock).
 */
export function updateInstance(
  list: SceneAssetInstance[],
  id: string,
  patch: SceneAssetInstancePatch,
  now: () => string = () => new Date().toISOString(),
): SceneAssetInstance[] {
  return list.map((instance) =>
    instance.id === id ? { ...instance, ...patch, updatedAt: now() } : instance,
  );
}

/** Discards every instance in the given list. */
export function clearInstances(): SceneAssetInstance[] {
  return [];
}
