"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  getRoomArchitecture,
  metersToMm,
  mmToMeters,
  ROOM_ARCHITECTURE_SCHEMA_VERSION,
  withRoomArchitecture,
  type Room,
  type RoomArchitecture,
  type WallDefinition,
} from "@woodcraft/shared";
import { apiClient } from "@/lib/api";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceUiStore } from "../../state/use-workspace-ui";

// Draw-wall canvas tool.
//
// Mounts an invisible click plane at floor level covering the current
// working area. When the tool is armed (drawWall.phase !== "idle"), the
// plane swallows floor clicks:
//   · phase "awaitStart" → record the click's world XZ as the start.
//   · phase "awaitEnd"   → record the click's XZ as the end, insert the
//     new wall into the room's architecture, PATCH, and reset the tool.
//
// The tool never fires when architecture-edit mode is off, so it doesn't
// steal clicks from the regular cabinet/scene-asset selection path.
//
// A live preview line is drawn between the captured start and the current
// pointer position (pointer-move tracking on the same plane).

const CLICK_PLANE_SIZE_M = 60; // 60 m ≈ six suburban rooms — plenty of room to sketch.
const PREVIEW_COLOR = "#c8852a";
const PREVIEW_Y_M = 0.006;

interface Props {
  projectId: string;
  room: Room | undefined;
}

export function DrawWallTool({ projectId, room }: Props) {
  const architectureEditMode = useWorkspaceUiStore((s) => s.architectureEditMode);
  const drawWall = useWorkspaceUiStore((s) => s.drawWall);
  const setDrawWallStart = useWorkspaceUiStore((s) => s.setDrawWallStart);
  const cancelDrawWall = useWorkspaceUiStore((s) => s.cancelDrawWall);
  const updateRoom = useEditorStore((s) => s.updateRoom);

  const active = architectureEditMode === "on" && drawWall.phase !== "idle";

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrawWall();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, cancelDrawWall]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!active || !room) return;
      e.stopPropagation();
      const p = e.point;
      const clickMm = { x: metersToMm(p.x), z: metersToMm(p.z) };
      if (drawWall.phase === "awaitStart") {
        setDrawWallStart(clickMm);
        return;
      }
      if (drawWall.phase === "awaitEnd" && drawWall.startMm) {
        const arch = getRoomArchitecture({
          metadata: room.metadata ?? null,
          width: Number(room.width),
          height: Number(room.height),
          depth: Number(room.depth),
        });
        const nextArch = appendWall(arch, drawWall.startMm, clickMm);
        cancelDrawWall();
        void (async () => {
          try {
            const metadata = withRoomArchitecture(room.metadata, nextArch);
            const updated = await apiClient.patch<Room>(
              `/projects/${projectId}/rooms/${room.id}`,
              { metadata },
            );
            updateRoom(room.id, { metadata: updated.metadata ?? metadata });
          } catch (err) {
            console.error("Draw wall PATCH failed:", err);
          }
        })();
      }
    },
    [active, drawWall, room, projectId, setDrawWallStart, cancelDrawWall, updateRoom],
  );

  // Preview line — only when we've captured the start and are waiting
  // for the end click. We track the pointer via `onPointerMove` on the
  // same plane and stash the last pointer position in a mutable ref
  // rendered as a small ephemeral line. React state is fine here — the
  // pointer move rate is modest and the line is tiny.
  const [pointerMm, setPointerMm] = usePointer();
  const previewPoints = useMemo(() => {
    if (!drawWall.startMm || !pointerMm) return null;
    return [
      new THREE.Vector3(mmToMeters(drawWall.startMm.x), PREVIEW_Y_M, mmToMeters(drawWall.startMm.z)),
      new THREE.Vector3(mmToMeters(pointerMm.x), PREVIEW_Y_M, mmToMeters(pointerMm.z)),
    ];
  }, [drawWall.startMm, pointerMm]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active) return;
      const p = e.point;
      setPointerMm({ x: metersToMm(p.x), z: metersToMm(p.z) });
    },
    [active, setPointerMm],
  );

  if (!active) return null;

  return (
    <group>
      {/* Invisible click plane. `visible={false}` still receives pointer
          events in R3F. Placed slightly above y=0 so it wins the raycast
          against the polygon floor mesh. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <planeGeometry args={[CLICK_PLANE_SIZE_M, CLICK_PLANE_SIZE_M]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {previewPoints && (
        <Line points={previewPoints} color={PREVIEW_COLOR} lineWidth={1.5} dashed />
      )}
    </group>
  );
}

// ── State helper ────────────────────────────────────────────────────────

function usePointer(): [
  { x: number; z: number } | null,
  (p: { x: number; z: number } | null) => void,
] {
  const [p, setP] = useState<{ x: number; z: number } | null>(null);
  return [p, setP];
}

// ── Pure helper ─────────────────────────────────────────────────────────

/** Appends a new wall spanning [startMm → endMm] to the architecture.
 *  Height/thickness copied from the first existing wall so the new wall
 *  visually matches the room. If there are no walls yet, defaults kick in
 *  (2400 mm high, 50 mm thick — matches LEGACY_WALL_THICKNESS_MM). */
function appendWall(
  arch: RoomArchitecture,
  startMm: { x: number; z: number },
  endMm: { x: number; z: number },
): RoomArchitecture {
  const heightMm = arch.walls[0]?.heightMm ?? 2400;
  const thicknessMm = arch.walls[0]?.thicknessMm ?? 50;
  const wall: WallDefinition = {
    id: nextWallId(arch),
    startMm: { ...startMm },
    endMm: { ...endMm },
    heightMm,
    thicknessMm,
    openings: [],
  };
  return {
    ...arch,
    schemaVersion: ROOM_ARCHITECTURE_SCHEMA_VERSION,
    walls: [...arch.walls, wall],
  };
}

function nextWallId(arch: RoomArchitecture): string {
  const existing = new Set(arch.walls.map((w) => w.id));
  let i = 1;
  while (existing.has(`wall:custom:${i}`)) i++;
  return `wall:custom:${i}`;
}
