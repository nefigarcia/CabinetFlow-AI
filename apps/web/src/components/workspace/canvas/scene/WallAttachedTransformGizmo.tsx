"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  getWallFrame,
  mmToMeters,
  resolveWithWall,
  worldToWallLocal,
  type SceneAssetDefinition,
  type SceneAssetInstance,
  type SceneAssetInstancePlacement,
  type WallDefinition,
} from "@woodcraft/shared";
import { useSceneAssets } from "@/hooks/useSceneAssets";
import { useSceneAssetsStore } from "@/store/sceneAssets";

// Wall-local TransformControls gizmo.
//
// Attaches to an invisible PROXY <group> that lives at the wall's start
// point, rotated so its local X axis runs along the wall's tangent and
// local Y is world-up. The gizmo runs in "local" space, so its X handle
// drags ALONG the wall and its Y handle drags VERTICALLY. The Z (wall-
// normal / surface offset) handle is hidden — MVP UX keeps surface
// offset in the inspector's numeric field so users don't accidentally
// pull assets away from the wall face.
//
// On drag end, the proxy's local position IS the new wall-local anchor;
// we project it directly into WallLocalPoint and PATCH placement.wall.
// Because the anchor is authoritative, the derived world transform is
// recomputed on the next render (SceneAssetItem calls the resolver).

interface Props {
  projectId: string;
  instance: SceneAssetInstance & { placement: SceneAssetInstancePlacement };
  definition: SceneAssetDefinition;
  wall: WallDefinition;
}

export function WallAttachedTransformGizmo({
  projectId,
  instance,
  definition,
  wall,
}: Props) {
  const { save } = useSceneAssets(projectId);
  const updateInstance = useSceneAssetsStore((s) => s.updateInstance);
  const orbit = useThree(
    (s) => s.controls as (THREE.EventDispatcher & { enabled?: boolean }) | null,
  );

  const frame = useMemo(() => getWallFrame(wall), [wall]);

  // Proxy: two nested groups.
  //   · outer group positioned at wall start, rotated by -angleRad so
  //     local X = along wall, local Z = wall inward normal (matches
  //     wallLocalToWorld math).
  //   · inner group ("anchor") position = current wall-local anchor.
  //     TransformControls attaches to the anchor.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);
  const draggingRef = useRef(false);

  // Sync the anchor's position to the current wall-local placement
  // every render — external inspector edits stay in sync with the gizmo.
  useEffect(() => {
    if (!anchor || !instance.placement.wall) return;
    const local = instance.placement.wall.localPositionMm;
    anchor.position.set(mmToMeters(local.x), mmToMeters(local.y), mmToMeters(local.z));
    anchor.updateMatrixWorld();
  }, [instance.placement, anchor]);

  const handleMouseDown = useCallback(() => {
    draggingRef.current = true;
    if (orbit && "enabled" in orbit) orbit.enabled = false;
  }, [orbit]);

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (orbit && "enabled" in orbit) orbit.enabled = true;

    if (!anchor) return;

    // The proxy's WORLD position is the new wall-local anchor's world
    // point. Project back to wall-local coords using the domain helper.
    // We deliberately avoid reading `anchor.position` directly — its
    // parent's rotation would give us stale local coords if the wall
    // rotated between renders.
    const worldMm = {
      x: anchor.matrixWorld.elements[12]! * 1000,
      y: anchor.matrixWorld.elements[13]! * 1000,
      z: anchor.matrixWorld.elements[14]! * 1000,
    };
    const local = worldToWallLocal(frame, worldMm);
    // Clamp along-wall X to [0, wallLength] so the anchor can't slip
    // past either endpoint and the resolver stays well-defined.
    const clampedX = Math.max(0, Math.min(frame.lengthMm, local.xMm));
    const clampedY = Math.max(0, local.yMm);
    const nextPlacement: SceneAssetInstancePlacement = {
      mode: "wall",
      wall: {
        wallId: instance.placement.wall!.wallId,
        localPositionMm: { x: clampedX, y: clampedY, z: local.zMm },
      },
    };
    const resolved = resolveWithWall({
      attachment: nextPlacement.wall!,
      definition,
      wall,
    });
    const patch = {
      placement: nextPlacement,
      positionMm: resolved.positionMm,
      rotationDeg: resolved.rotationDeg,
    };
    updateInstance(instance.id, patch);
    void save(instance.id, patch);
  }, [
    orbit,
    frame,
    wall,
    definition,
    instance.id,
    instance.placement,
    save,
    updateInstance,
    anchor,
  ]);

  useEffect(() => {
    return () => {
      if (draggingRef.current && orbit && "enabled" in orbit) {
        orbit.enabled = true;
      }
    };
  }, [orbit]);

  const startWorld = useMemo(
    () => ({
      x: mmToMeters(wall.startMm.x),
      z: mmToMeters(wall.startMm.z),
    }),
    [wall.startMm.x, wall.startMm.z],
  );

  return (
    <group
      position={[startWorld.x, 0, startWorld.z]}
      rotation={[0, -frame.angleRad, 0]}
    >
      <group ref={setAnchor} />
      {anchor && (
        <TransformControls
          object={anchor}
          mode="translate"
          space="local"
          showX
          showY
          showZ={false}
          size={0.6}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}
    </group>
  );
}
