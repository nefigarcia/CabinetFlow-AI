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
//     catalog's declared dimensions with a bottom-center anchor.
//   · Enable shadows on every mesh in the cloned scene.
//
// Scale composition (two DISTINCT scales must never be mixed on the
// same object):
//   1. INSTANCE scale — owned by SceneAssetInstance.scale, applied on
//      the outer instance <group> in SceneAssetItem. TransformControls
//      manipulates this and only this.
//   2. NORMALIZATION scale — derived from the raw GLB bbox vs. catalog
//      dims. Lives on an INTERMEDIATE <group> emitted by this loader,
//      never on the cloned GLB scene root itself. This preserves the
//      authored root transform of the GLB (which some exporters set to
//      non-identity for unit / axis conventions).
//
// Rendered hierarchy:
//   <group scale={instance.scale}>          // outer (SceneAssetItem)
//     <group scale={t.scale}                // this loader
//            position={t.offsetMeters}
//            rotation={t.rotationRad}>
//       <primitive object={cloneWithAuthoredTransformIntact} />
//     </group>
//   </group>
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
  // changes. The clone's OWN authored root transform is preserved — the
  // normalization transform is emitted on an outer <group> in the JSX
  // below. Position/rotation/scale of the OUTER instance group are
  // applied by `SceneAssetItem`.
  const { modelObject, normalization, meshCount, rawBbox } = useMemo(() => {
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
    // The bbox reflects the clone's authored root transform because
    // `setFromObject` uses matrixWorld; that's what we want, because
    // `computeNormalizationTransform` returns a multiplier that will be
    // applied by our OUTER <group> — the authored transform stays on
    // the clone itself and is composed correctly in the scene graph.
    const box = new THREE.Box3().setFromObject(clone);
    const raw = {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    };
    const t = computeNormalizationTransform(raw, definition);

    return {
      modelObject: clone,
      normalization: t,
      meshCount: meshes,
      rawBbox: raw,
    };
  }, [scene, definition]);

  // Alias for load-status reporting + display below. The single scalar
  // normalization ratio; the loader reports this as the "normalization
  // scale" so downstream diagnostics stay unchanged.
  const scale = normalization.scale;

  // Record success into the dev-only load-status registry so the
  // inspector can distinguish "real GLB rendered" from "primitive
  // fallback swapped in by the error boundary". The registry is
  // idempotent — repeated identical writes are no-ops and never
  // notify subscribers.
  useEffect(() => {
    recordSceneAssetLoaded({
      url,
      meshCount,
      rawBboxMeters: rawBbox,
      normalizationScale: scale,
    });
    if (process.env.NODE_ENV !== "production") {
      // One-shot dev log per URL change — enough to confirm the exact
      // string useGLTF received, without spamming the console every
      // render.
      console.log("[SceneAssetLoader] loaded", url, { meshCount });
    }
  }, [url, meshCount, rawBbox, scale]);

  // Free per-instance resources on unmount. drei's cache owns the parsed
  // GLB itself; we only own the clone's THREE.Group.
  useEffect(() => {
    return () => {
      modelObject.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
        }
      });
    };
  }, [modelObject]);

  return (
    <group
      position={[
        normalization.offsetMeters.x,
        normalization.offsetMeters.y,
        normalization.offsetMeters.z,
      ]}
      rotation={[
        normalization.rotationRad.x,
        normalization.rotationRad.y,
        normalization.rotationRad.z,
      ]}
      scale={normalization.scale}
    >
      <primitive object={modelObject} />
    </group>
  );
}

/** Optional preload — call from a container that knows an asset will
 *  soon be visible (e.g. hover on a catalog card). Cheap no-op if the
 *  URL is already cached. */
export function preloadSceneAsset(url: string): void {
  useGLTF.preload(url);
}
