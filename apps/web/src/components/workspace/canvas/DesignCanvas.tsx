"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceUiStore } from "../state/use-workspace-ui";
import { RoomShell } from "@/components/editor/RoomShell";
import { CabinetSceneItem } from "./scene/CabinetSceneItem";
import type { Cabinet, Room } from "@woodcraft/shared";

// The design canvas hosts the R3F scene: room shell, cabinet meshes,
// lighting, controls, and environment. Layout / toolbars / panels are
// entirely outside this component — everything here is scene concerns.

interface Props {
  room: Room | undefined;
  cabinets: Cabinet[];
}

// Small child component that reads the `fitViewNonce` from the workspace
// UI store and repositions the camera on demand. Must live inside the
// Canvas so `useThree()` can access the R3F state.
function FitViewOnRequest() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const fitViewNonce = useWorkspaceUiStore((s) => s.fitViewNonce);

  useEffect(() => {
    if (!fitViewNonce) return;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    // Simple deterministic reset — the initial framing chosen when the
    // editor first mounts. Good-enough Fit View for STEP 2. A geometry-
    // aware fit lands in a later milestone.
    camera.position.set(3, 2.5, 4);
    camera.lookAt(1, 0.5, 1);
    if (controlsRef.current) {
      controlsRef.current.target.set(1, 0.5, 1);
      controlsRef.current.update();
    }
  }, [fitViewNonce, camera]);

  return <OrbitControls ref={controlsRef} makeDefault />;
}

export function DesignCanvas({ room, cabinets }: Props) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);

  return (
    <Canvas
      shadows
      camera={{ position: [3, 2.5, 4], fov: 50 }}
      onPointerMissed={() => selectCabinet(null)}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Grid
        args={[20, 20]}
        cellSize={0.6}
        cellThickness={0.5}
        cellColor="#2e2e2e"
        sectionSize={1.2}
        sectionThickness={1}
        sectionColor="#3a3a3a"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      {room && <RoomShell room={room} cabinets={cabinets} />}
      {cabinets.map((cab) => (
        <CabinetSceneItem key={cab.id} cabinet={cab} />
      ))}
      <FitViewOnRequest />
      <Environment preset="warehouse" background={false} />
    </Canvas>
  );
}
