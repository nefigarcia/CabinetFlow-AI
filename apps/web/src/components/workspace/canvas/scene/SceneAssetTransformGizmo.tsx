"use client";

import { useCallback, useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  metersToMm,
  radiansToDegrees,
  type SceneAssetInstance,
} from "@woodcraft/shared";
import { useSceneAssets } from "@/hooks/useSceneAssets";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useWorkspaceUiStore } from "../../state/use-workspace-ui";

// TransformControls gizmo for a single selected Scene Asset.
//
// Mounted as a sibling of SceneAssetItem when its instance is selected —
// keeps the gizmo lifecycle scoped to the selection (unmount when
// deselected). Attaches to the item's `<group>` target so the gizmo drags
// the entire asset, not individual child meshes.
//
// Behavior per Slice 7:
//   · Modes: translate / rotate (scale intentionally NOT exposed — UI
//     keeps user-facing scale at identity per Slice 6 Scale Policy).
//   · OrbitControls disabled during drag so the camera doesn't fight the
//     gizmo. Restored on drag end.
//   · Local transform updates continuously during drag (Three.js applies
//     the delta directly to the target group).
//   · ONE `PATCH scene-assets/:id` fires on drag end — never per frame.
//   · If PATCH fails, we log; the local optimistic value stays visible.
//     The inspector's own error path (Slice 6) surfaces the failure text.

interface Props {
  projectId: string;
  instance: SceneAssetInstance;
  target: THREE.Object3D;
}

/** Small helper: read the target's live world transform, coerce to
 *  domain-space (mm + degrees), return the API update patch. */
function readPatchFromTarget(target: THREE.Object3D) {
  const pos = target.position;
  const rot = target.rotation;
  return {
    positionMm: {
      x: metersToMm(pos.x),
      y: metersToMm(pos.y),
      z: metersToMm(pos.z),
    },
    rotationDeg: {
      x: radiansToDegrees(rot.x),
      y: radiansToDegrees(rot.y),
      z: radiansToDegrees(rot.z),
    },
  };
}

export function SceneAssetTransformGizmo({ projectId, instance, target }: Props) {
  const mode = useWorkspaceUiStore((s) => s.sceneAssetTransformMode);
  const { save } = useSceneAssets(projectId);
  const updateInstance = useSceneAssetsStore((s) => s.updateInstance);

  // Grab the default OrbitControls that DesignCanvas mounts with
  // `makeDefault`. Present at runtime; typed loosely because R3F's
  // context type is not per-controls specific.
  const orbit = useThree(
    (state) => state.controls as (THREE.EventDispatcher & { enabled?: boolean }) | null,
  );

  // Track whether we've already committed for the current drag so we
  // never send duplicate PATCHes if drei fires the mouse-up event twice.
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(() => {
    draggingRef.current = true;
    if (orbit && "enabled" in orbit) orbit.enabled = false;
  }, [orbit]);

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (orbit && "enabled" in orbit) orbit.enabled = true;

    // Commit the final transform to both the local store (so the
    // selection outline / spatial validation update instantly) and to
    // the server via a debounce-free PATCH.
    const patch = readPatchFromTarget(target);
    updateInstance(instance.id, patch);
    void save(instance.id, patch);
  }, [orbit, target, instance.id, save, updateInstance]);

  // Belt-and-suspenders: if we unmount mid-drag (e.g. selection changes
  // while dragging), restore the OrbitControls state so the camera isn't
  // stuck disabled.
  useEffect(() => {
    return () => {
      if (draggingRef.current && orbit && "enabled" in orbit) {
        orbit.enabled = true;
      }
    };
  }, [orbit]);

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.75}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  );
}
