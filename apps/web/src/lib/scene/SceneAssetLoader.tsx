"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  computeNormalizationTransform,
  type SceneAssetDefinition,
} from "@woodcraft/shared";
import { recordSceneAssetLoaded } from "./sceneAssetLoadStatus";

// GLB / glTF loader for Scene Assets.
//
// Responsibilities:
//   · Fetch + parse the GLB via drei's `useGLTF` (which caches at the URL
//     level for us — repeated instances hit the cache).
//   · Safely CLONE the scene per instance so per-instance transforms and
//     material overrides never bleed into the shared root. Uses
//     `SkeletonUtils.clone` when the model contains a SkinnedMesh so the
//     skeleton is deep-cloned correctly.
//   · Compute a deterministic NORMALIZATION transform (using the shared
//     `computeNormalizationTransform` pure math) so the model fits the
//     catalog's declared dimensions with a bottom-center anchor, then
//     apply it to the cloned scene's transform.
//   · Enable shadows on every mesh in the cloned scene.
//
// This component MUST be rendered inside a React Suspense boundary — the
// underlying `useGLTF` suspends while the GLB streams in. `SceneAssetItem`
// wraps it accordingly.
//
// Errors: if the URL 404s or the GLB is corrupt, `useGLTF` throws. The
// caller wraps this component in an error boundary that swaps in the
// primitive renderer, so a single bad model can never crash the canvas.

interface Props {
  url: string;
  definition: Pick<SceneAssetDefinition, "dimensionsMm" | "model">;
}

/** Depth-first check for any SkinnedMesh descendant. */
function containsSkinnedMesh(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) found = true;
  });
  return found;
}

function cloneSceneSafe(scene: THREE.Object3D): THREE.Object3D {
  // SkeletonUtils.clone deep-clones bones + skeleton refs so multiple
  // skinned copies don't share pose state. Overkill for static meshes,
  // so we only pay the cost when needed.
  return containsSkinnedMesh(scene)
    ? (SkeletonUtils.clone(scene) as THREE.Object3D)
    : scene.clone(true);
}

export function SceneAssetLoader({ url, definition }: Props) {
  const { scene } = useGLTF(url);

  // Compute a fresh clone whenever the URL or definition normalization
  // changes. Position/rotation/scale of the parent group are applied by
  // `SceneAssetItem` — this component only owns the model-local transform.
  const { normalized, meshCount, rawBbox, scale } = useMemo(() => {
    const clone = cloneSceneSafe(scene);

    let meshes = 0;
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes += 1;
      }
    });

    // Compute normalization from the CLONED bbox (some GLBs alter their
    // bbox during animation setup; the raw scene value can be stale).
    const box = new THREE.Box3().setFromObject(clone);
    const raw = {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    };
    const t = computeNormalizationTransform(raw, definition);

    // Apply as clone's own transform. Scaling is uniform (single scalar).
    clone.scale.setScalar(t.scale);
    clone.position.set(t.offsetMeters.x, t.offsetMeters.y, t.offsetMeters.z);
    clone.rotation.set(t.rotationRad.x, t.rotationRad.y, t.rotationRad.z);

    return { normalized: clone, meshCount: meshes, rawBbox: raw, scale: t.scale };
  }, [scene, definition]);

  // Record success into the dev-only load-status registry so the
  // inspector can distinguish "real GLB rendered" from "primitive
  // fallback swapped in by the error boundary".
  useEffect(() => {
    recordSceneAssetLoaded({
      url,
      meshCount,
      rawBboxMeters: rawBbox,
      normalizationScale: scale,
    });
  }, [url, meshCount, rawBbox, scale]);

  // Free per-instance resources on unmount. drei's cache owns the parsed
  // GLB itself; we only own the clone's THREE.Group.
  useEffect(() => {
    return () => {
      normalized.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
        }
      });
    };
  }, [normalized]);

  return <primitive object={normalized} />;
}

/** Optional preload — call from a container that knows an asset will
 *  soon be visible (e.g. hover on a catalog card). Cheap no-op if the
 *  URL is already cached. */
export function preloadSceneAsset(url: string): void {
  useGLTF.preload(url);
}
