"use client";

import { useMemo } from "react";
import type * as THREE from "three";
import {
  compileWall,
  getRoomArchitecture,
  mmToMeters,
  type Cabinet,
  type CompiledOpening,
  type Room,
  type WallDefinition,
  type WallSegment,
} from "@woodcraft/shared";
import { useMaterialsStore } from "@/store/materials";
import { useSlotMaterial } from "@/lib/render/materials";
import { useWorkspaceUiStore } from "../workspace/state/use-workspace-ui";

// RoomShell — architectural room enclosure.
//
// This renderer consumes the deterministic wall/opening geometry from the
// shared architecture compiler. Each wall is compiled into a list of
// SOLID SEGMENTS in wall-local coordinates; the renderer places each
// segment as a THREE.Box with the wall's thickness and rotates it into
// place along the wall.
//
// Walls are drawn with their centerline offset OUTWARD by half the
// thickness, so the inner face lies exactly on the architecture's design
// line. This preserves the interior floor area (0,0)→(w,d) that existing
// cabinet placements assume.
//
// Openings (doors, windows, generic) appear as holes automatically — the
// compiler simply omits solid segments in their region.
//
// The floor spans the room's declared width/depth. The ceiling is
// rendered based on `architecture.ceiling?.visibility` (default `auto`,
// which hides the ceiling so the camera can look inside).

interface Props {
  room: Room;
  cabinets: Cabinet[];
}

/** Height in mm above the floor where the backsplash sits — legacy value
 *  preserved for backward compatibility with kitchen material previews. */
const COUNTER_HEIGHT_MM = 870;
const BACKSPLASH_HEIGHT_MM = 500;

export function RoomShell({ room, cabinets }: Props) {
  const selection = useMaterialsStore((s) => s.selection);
  const showArchitectureOverlays = useWorkspaceUiStore(
    (s) => s.showArchitectureOverlays,
  );

  const architecture = useMemo(() => getRoomArchitecture(room), [room]);

  const wMm = Number(room.width);
  const hMm = Number(room.height);
  const dMm = Number(room.depth);

  const floorMat = useSlotMaterial(selection, null, "floor", {
    face: { widthMm: wMm, heightMm: dMm },
  });

  const ceilingMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: wMm, heightMm: dMm },
  });

  const backsplashMat = useSlotMaterial(selection, null, "backsplash", {
    face: { widthMm: wMm, heightMm: BACKSPLASH_HEIGHT_MM },
  });

  const hasBaseCabinet = cabinets.some(
    (c) => c.type === "base" || c.type === "sink_base" || c.type === "drawer_base",
  );

  const ceilingVisibility = architecture.ceiling?.visibility ?? "auto";

  return (
    <group>
      {/* Floor — thin slab centered under the room, top face at y=0 */}
      <mesh
        position={[mmToMeters(wMm) / 2, -0.01, mmToMeters(dMm) / 2]}
        receiveShadow
        material={floorMat}
      >
        <boxGeometry args={[mmToMeters(wMm), 0.02, mmToMeters(dMm)]} />
      </mesh>

      {/* Walls — one WallGroup per architectural wall. */}
      {architecture.walls.map((wall) => (
        <WallGroup key={wall.id} wall={wall} />
      ))}

      {/* Ceiling — hidden by default so the camera can look inside. */}
      {ceilingVisibility === "visible" && (
        <mesh
          position={[mmToMeters(wMm) / 2, mmToMeters(hMm) + 0.01, mmToMeters(dMm) / 2]}
          receiveShadow
          material={ceilingMat}
        >
          <boxGeometry args={[mmToMeters(wMm), 0.02, mmToMeters(dMm)]} />
        </mesh>
      )}

      {/* Backsplash — kept for kitchen material previews. Positioned on the
          south wall (legacy assumption for "back wall behind cabinets"). */}
      {hasBaseCabinet && (
        <mesh
          position={[
            mmToMeters(wMm) / 2,
            mmToMeters(COUNTER_HEIGHT_MM + BACKSPLASH_HEIGHT_MM / 2),
            -0.003,
          ]}
          receiveShadow
          material={backsplashMat}
        >
          <boxGeometry
            args={[mmToMeters(wMm) * 0.98, mmToMeters(BACKSPLASH_HEIGHT_MM), 0.006]}
          />
        </mesh>
      )}

      {/* Architecture overlays: door/window outlines. Editor-only. */}
      {showArchitectureOverlays &&
        architecture.walls.flatMap((wall) => {
          const compiled = compileWall(wall);
          return compiled.openings.map((op) => (
            <OpeningOutline
              key={`${wall.id}:${op.openingId}`}
              wall={wall}
              opening={op}
            />
          ));
        })}
    </group>
  );
}

// ── Wall renderer ───────────────────────────────────────────────────────

/**
 * Renders every solid segment of one wall. Calls the material hook once
 * per wall (safe because each wall is a distinct component instance) —
 * the material's face size is set to the wall's total length × height so
 * texture tiling matches the wall's real dimensions.
 */
function WallGroup({ wall }: { wall: WallDefinition }) {
  const selection = useMaterialsStore((s) => s.selection);

  const compiled = useMemo(() => compileWall(wall), [wall]);
  const wallLengthMm = compiled.frame.lengthMm;
  const thicknessM = mmToMeters(wall.thicknessMm);

  const wallMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: wallLengthMm, heightMm: wall.heightMm },
  });

  // Offset the wall outward by half its thickness so the inner face lies
  // on the architecture line — preserves the legacy interior footprint.
  const outwardNx = -compiled.frame.normal.x;
  const outwardNz = -compiled.frame.normal.z;
  const halfThicknessMm = wall.thicknessMm / 2;
  const offsetStartXM = mmToMeters(
    wall.startMm.x + outwardNx * halfThicknessMm,
  );
  const offsetStartZM = mmToMeters(
    wall.startMm.z + outwardNz * halfThicknessMm,
  );

  // Group is rotated so its local X aligns with the wall's tangent.
  // Local Y is world Y. Segments are placed at their wall-local center.
  return (
    <group
      position={[offsetStartXM, 0, offsetStartZM]}
      rotation={[0, -compiled.frame.angleRad, 0]}
    >
      {compiled.segments.map((seg, idx) => (
        <SegmentMesh
          key={idx}
          segment={seg}
          thicknessM={thicknessM}
          material={wallMat}
        />
      ))}
    </group>
  );
}

function SegmentMesh({
  segment,
  thicknessM,
  material,
}: {
  segment: WallSegment;
  thicknessM: number;
  material: THREE.Material;
}) {
  const widthM = mmToMeters(segment.xEndMm - segment.xStartMm);
  const heightM = mmToMeters(segment.yTopMm - segment.yBottomMm);
  const centerXM = mmToMeters((segment.xStartMm + segment.xEndMm) / 2);
  const centerYM = mmToMeters((segment.yBottomMm + segment.yTopMm) / 2);

  return (
    <mesh
      position={[centerXM, centerYM, thicknessM / 2]}
      castShadow
      receiveShadow
      material={material}
    >
      <boxGeometry args={[widthM, heightM, thicknessM]} />
    </mesh>
  );
}

// ── Editor overlays ─────────────────────────────────────────────────────

const OPENING_OUTLINE_COLOR: Record<CompiledOpening["type"], string> = {
  door: "#c8852a",
  window: "#6ab5c8",
  opening: "#9a9288",
};

function OpeningOutline({
  wall,
  opening,
}: {
  wall: WallDefinition;
  opening: CompiledOpening;
}) {
  const frame = useMemo(() => compileWall(wall).frame, [wall]);
  const widthM = mmToMeters(opening.xEndMm - opening.xStartMm);
  const heightM = mmToMeters(opening.yTopMm - opening.yBottomMm);
  const centerXM = mmToMeters((opening.xStartMm + opening.xEndMm) / 2);
  const centerYM = mmToMeters((opening.yBottomMm + opening.yTopMm) / 2);

  const outwardNx = -frame.normal.x;
  const outwardNz = -frame.normal.z;
  const halfThicknessMm = wall.thicknessMm / 2;
  const offsetStartXM = mmToMeters(
    wall.startMm.x + outwardNx * halfThicknessMm,
  );
  const offsetStartZM = mmToMeters(
    wall.startMm.z + outwardNz * halfThicknessMm,
  );
  const thicknessM = mmToMeters(wall.thicknessMm);

  return (
    <group
      position={[offsetStartXM, 0, offsetStartZM]}
      rotation={[0, -frame.angleRad, 0]}
    >
      <mesh position={[centerXM, centerYM, thicknessM + 0.001]}>
        <planeGeometry args={[widthM, heightM]} />
        <meshBasicMaterial
          color={OPENING_OUTLINE_COLOR[opening.type]}
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>
    </group>
  );
}

