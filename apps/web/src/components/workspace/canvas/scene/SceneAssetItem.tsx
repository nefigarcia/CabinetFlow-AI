"use client";

import { Component, Suspense, useCallback, useState, type ReactNode } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import {
  degreesToRadians,
  getPrimitiveShape,
  getRoomArchitecture,
  hasModel,
  isWallAttached,
  mmToMeters,
  resolveWallAttachedSceneAssetTransform,
  type PrimitiveShape,
  type SceneAssetDefinition,
  type SceneAssetInstance,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";
import { resolveSceneAssetUrl } from "@/lib/scene/resolveSceneAssetUrl";
import { SceneAssetLoader } from "@/lib/scene/SceneAssetLoader";
import { SceneAssetTransformGizmo } from "./SceneAssetTransformGizmo";
import { WallAttachedTransformGizmo } from "./WallAttachedTransformGizmo";

// Renders a single Scene Asset instance.
//
// Dispatch:
//   · If the definition has a `model` (GLB assetKey) → SceneAssetLoader.
//     Wrapped in Suspense (streaming) + an ErrorBoundary that swaps in the
//     primitive fallback. A single bad model can NEVER crash the canvas.
//   · Otherwise → the primitive shape from Slice 2.
//
// Coordinate anchor: the group's origin is the BOTTOM-CENTER of the asset.
// GLB models are normalized inside SceneAssetLoader to match this anchor;
// primitives are authored to it directly.
//
// The group's THREE.Group reference is exposed via a ref-callback so the
// TransformControls gizmo (mounted at the layer level) can attach to it.
// The layer looks up the currently-selected instance by id in a small
// registry (see `sceneAssetObjectRegistry` below).

interface Props {
  projectId: string;
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition;
}

const COLOR_STRUCTURE = "#8a8a8a";
const COLOR_RUG = "#4a4a4a";
const COLOR_FOLIAGE = "#6b7d5a";
const COLOR_POT = "#8b5a3c";
const COLOR_SELECTION = "#c8852a";

// ── Component ───────────────────────────────────────────────────────────

export function SceneAssetItem({ projectId, instance, definition }: Props) {
  const isSelected = useEditorStore((s) => s.selectedSceneAssetId) === instance.id;
  const selectSceneAsset = useEditorStore((s) => s.selectSceneAsset);
  const room = useEditorStore((s) =>
    s.rooms.find((r) => r.id === instance.roomId),
  );

  // Group ref stored as React state so mounting the TransformControls
  // gizmo (which needs a live THREE.Object3D target) triggers a rerender
  // once the ref attaches. Callback ref pattern.
  const [groupObject, setGroupObject] = useState<THREE.Group | null>(null);
  const attachGroupRef = useCallback((g: THREE.Group | null) => {
    setGroupObject(g);
  }, []);

  const wM = mmToMeters(definition.dimensionsMm.widthMm);
  const hM = mmToMeters(definition.dimensionsMm.heightMm);
  const dM = mmToMeters(definition.dimensionsMm.depthMm);

  // Wall-attached instances derive their world transform from the wall.
  // Free-mode instances use the persisted world transform directly. The
  // resolver returns null if the wall id no longer exists — we fall back
  // to the persisted world transform so the asset remains visible and
  // the user can detach it via the inspector.
  const resolved =
    isWallAttached(instance.placement) && room
      ? resolveWallAttachedSceneAssetTransform({
          attachment: instance.placement.wall,
          definition,
          architecture: getRoomArchitecture({
            metadata: room.metadata ?? null,
            width: Number(room.width),
            height: Number(room.height),
            depth: Number(room.depth),
          }),
        })
      : null;

  const worldPos = resolved?.positionMm ?? instance.positionMm;
  const worldRot = resolved?.rotationDeg ?? instance.rotationDeg;

  const pxM = mmToMeters(worldPos.x);
  const pyM = mmToMeters(worldPos.y);
  const pzM = mmToMeters(worldPos.z);

  const rx = degreesToRadians(worldRot.x);
  const ry = degreesToRadians(worldRot.y);
  const rz = degreesToRadians(worldRot.z);

  const shape = getPrimitiveShape(definition);
  const modelUrl = hasModel(definition)
    ? resolveSceneAssetUrl(definition.model!.assetKey)
    : null;

  if (!instance.visible) return null;

  const primitive = (
    <PrimitiveMesh shape={shape} widthM={wM} heightM={hM} depthM={dM} />
  );

  return (
    <>
      <group
        ref={attachGroupRef}
        position={[pxM, pyM, pzM]}
        rotation={[rx, ry, rz]}
        scale={[instance.scale.x, instance.scale.y, instance.scale.z]}
        onClick={(e) => {
          e.stopPropagation();
          selectSceneAsset(instance.id);
        }}
      >
        {modelUrl ? (
          <SceneAssetErrorBoundary fallback={primitive}>
            <Suspense fallback={primitive}>
              <SceneAssetLoader url={modelUrl} definition={definition} />
            </Suspense>
          </SceneAssetErrorBoundary>
        ) : (
          primitive
        )}
        {isSelected && (
          <SelectionBoundingBox widthM={wM} heightM={hM} depthM={dM} />
        )}
      </group>
      {/* Free-XYZ TransformControls only for free-mode instances. */}
      {isSelected && groupObject && !isWallAttached(instance.placement) && (
        <SceneAssetTransformGizmo
          projectId={projectId}
          instance={instance}
          target={groupObject}
        />
      )}
      {/* Wall-local gizmo (translate-only, X + Y, wall-axis constrained)
          when a wall attachment is active AND the referenced wall still
          exists (`resolved` guarantees the wall). */}
      {isSelected && isWallAttached(instance.placement) && resolved && (
        <WallAttachedTransformGizmo
          projectId={projectId}
          instance={instance as SceneAssetInstance & { placement: typeof instance.placement }}
          definition={definition}
          wall={resolved.wall}
        />
      )}
    </>
  );
}

// ── Error boundary ──────────────────────────────────────────────────────
//
// A single failing GLB (404, corrupt, unsupported extension) triggers the
// `useGLTF` loader to throw. This boundary catches the throw and swaps in
// the primitive fallback so the surrounding room keeps rendering. The
// diagnostic goes to the console; no storage URL / credential leaks.

interface SceneAssetErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface SceneAssetErrorBoundaryState {
  errored: boolean;
}

class SceneAssetErrorBoundary extends Component<
  SceneAssetErrorBoundaryProps,
  SceneAssetErrorBoundaryState
> {
  state: SceneAssetErrorBoundaryState = { errored: false };

  static getDerivedStateFromError(): SceneAssetErrorBoundaryState {
    return { errored: true };
  }

  componentDidCatch(error: Error): void {
    console.warn("[SceneAssetItem] GLB load failed, using primitive fallback:", error.message);
  }

  render() {
    if (this.state.errored) return this.props.fallback;
    return this.props.children;
  }
}

// ── Selection outline ───────────────────────────────────────────────────

function SelectionBoundingBox({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  return (
    <mesh position={[0, heightM / 2, 0]} renderOrder={999}>
      <boxGeometry args={[widthM, heightM, depthM]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color={COLOR_SELECTION} threshold={15} linewidth={1.5} />
    </mesh>
  );
}

// ── Primitive fallback shapes ───────────────────────────────────────────

function PrimitiveMesh({
  shape,
  widthM,
  heightM,
  depthM,
}: {
  shape: PrimitiveShape;
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  switch (shape) {
    case "sofa":
      return <SofaPrimitive widthM={widthM} heightM={heightM} depthM={depthM} />;
    case "table":
      return <TablePrimitive widthM={widthM} heightM={heightM} depthM={depthM} />;
    case "plant":
      return <PlantPrimitive widthM={widthM} heightM={heightM} depthM={depthM} />;
    case "rug":
      return <RugPrimitive widthM={widthM} heightM={heightM} depthM={depthM} />;
    case "box":
    default:
      return <BoxPrimitive widthM={widthM} heightM={heightM} depthM={depthM} />;
  }
}

function BoxPrimitive({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  return (
    <mesh position={[0, heightM / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[widthM, heightM, depthM]} />
      <meshStandardMaterial color={COLOR_STRUCTURE} roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

function RugPrimitive({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  return (
    <mesh position={[0, heightM / 2, 0]} receiveShadow>
      <boxGeometry args={[widthM, heightM, depthM]} />
      <meshStandardMaterial color={COLOR_RUG} roughness={0.95} metalness={0} />
    </mesh>
  );
}

function SofaPrimitive({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  const seatH = heightM * 0.4;
  const backH = heightM * 0.6;
  const backD = depthM * 0.2;

  return (
    <group>
      <mesh position={[0, seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[widthM, seatH, depthM]} />
        <meshStandardMaterial color={COLOR_STRUCTURE} roughness={0.85} metalness={0.02} />
      </mesh>
      <mesh
        position={[0, seatH + backH / 2, -(depthM / 2 - backD / 2)]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[widthM, backH, backD]} />
        <meshStandardMaterial color={COLOR_STRUCTURE} roughness={0.85} metalness={0.02} />
      </mesh>
    </group>
  );
}

function TablePrimitive({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  const topT = Math.min(0.03, heightM * 0.1);
  const legT = Math.min(0.06, Math.min(widthM, depthM) * 0.06);
  const inset = 0.02;
  const legY = (heightM - topT) / 2;
  const legHalfX = widthM / 2 - legT / 2 - inset;
  const legHalfZ = depthM / 2 - legT / 2 - inset;

  return (
    <group>
      <mesh position={[0, heightM - topT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[widthM, topT, depthM]} />
        <meshStandardMaterial color={COLOR_STRUCTURE} roughness={0.7} metalness={0.05} />
      </mesh>
      {[
        [legHalfX, legY, legHalfZ],
        [legHalfX, legY, -legHalfZ],
        [-legHalfX, legY, legHalfZ],
        [-legHalfX, legY, -legHalfZ],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x!, y!, z!]} castShadow receiveShadow>
          <boxGeometry args={[legT, heightM - topT, legT]} />
          <meshStandardMaterial color={COLOR_STRUCTURE} roughness={0.7} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function PlantPrimitive({
  widthM,
  heightM,
  depthM,
}: {
  widthM: number;
  heightM: number;
  depthM: number;
}) {
  const potH = heightM * 0.35;
  const potRadius = (Math.min(widthM, depthM) / 2) * 0.7;
  const foliageRadius = Math.min(widthM, depthM) / 2;
  const foliageY = potH + Math.max(0, heightM - potH - foliageRadius);

  return (
    <group>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[potRadius, potRadius * 0.85, potH, 24]} />
        <meshStandardMaterial color={COLOR_POT} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, foliageY, 0]} castShadow>
        <sphereGeometry args={[foliageRadius, 20, 16]} />
        <meshStandardMaterial color={COLOR_FOLIAGE} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

