"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useEditorStore } from "@/store/editor";
import {
  compileWall,
  extractFloorPolygon,
  getDoorSwingGeometry,
  getRoomArchitecture,
  getWallRenderTransform,
  mmToMeters,
  polygonAabb,
  wallLocalToWorld,
  type Cabinet,
  type CompiledOpening,
  type FloorPolygon,
  type Room,
  type WallDefinition,
  type WallOpening,
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

  // Floor polygon derived from the walls. For legacy rectangular rooms
  // this yields exactly the (0,0)→(W,D) rectangle the old renderer had.
  // For a custom architecture (after Convert-to-Custom + wall moves) it
  // tracks the true polygon.
  const floorPolygon = useMemo(
    () => extractFloorPolygon(architecture),
    [architecture],
  );

  // Face-size hint for the material system — use the polygon AABB so
  // texture tiling stays sane for irregular rooms. Falls back to the
  // room W×D for the degenerate no-polygon case.
  const floorFaceMm = useMemo(() => {
    if (!floorPolygon) return { widthMm: wMm, heightMm: dMm };
    const b = polygonAabb(floorPolygon);
    if (!b) return { widthMm: wMm, heightMm: dMm };
    return {
      widthMm: b.max.x - b.min.x,
      heightMm: b.max.z - b.min.z,
    };
  }, [floorPolygon, wMm, dMm]);

  const floorMat = useSlotMaterial(selection, null, "floor", {
    face: floorFaceMm,
  });

  const ceilingMat = useSlotMaterial(selection, null, "wall", {
    face: floorFaceMm,
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
      {/* Floor — flat mesh cut to the polygon shape. Legacy rooms have a
          4-vertex polygon and are rendered identically to the old box
          slab (with y ≈ 0, receiveShadow on). Custom rooms follow the
          polygon exactly. */}
      {floorPolygon && (
        <PolygonSlab
          polygon={floorPolygon}
          yM={-0.005}
          material={floorMat}
          faceUp
        />
      )}

      {/* Walls — one WallGroup per architectural wall. */}
      {architecture.walls.map((wall) => (
        <WallGroup key={wall.id} wall={wall} />
      ))}

      {/* Ceiling — hidden by default so the camera can look inside. */}
      {ceilingVisibility === "visible" && floorPolygon && (
        <PolygonSlab
          polygon={floorPolygon}
          yM={mmToMeters(hMm) + 0.005}
          material={ceilingMat}
          faceUp={false}
        />
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

      {/* Architecture overlays: door/window outlines + door swing arcs.
          Editor-only. */}
      {showArchitectureOverlays &&
        architecture.walls.flatMap((wall) => {
          const compiled = compileWall(wall);
          return [
            ...compiled.openings.map((op) => (
              <OpeningOutline
                key={`${wall.id}:${op.openingId}`}
                wall={wall}
                opening={op}
              />
            )),
            ...wall.openings
              .filter((op): op is Extract<WallOpening, { type: "door" }> => op.type === "door")
              .map((door) => (
                <DoorSwingOverlay
                  key={`${wall.id}:${door.id}:swing`}
                  wall={wall}
                  door={door}
                />
              )),
            ...wall.openings
              .filter((op): op is Extract<WallOpening, { type: "window" }> => op.type === "window")
              .map((win) => (
                <WindowFrameOverlay
                  key={`${wall.id}:${win.id}:frame`}
                  wall={wall}
                  window={win}
                />
              )),
          ];
        })}

      {/* Dimension callouts for the currently-selected wall. Only shown
          in architecture-overlay mode so they don't clutter the default
          view. */}
      {showArchitectureOverlays && <SelectedWallDimensions architecture={architecture} />}
    </group>
  );
}

// ── Polygon floor / ceiling ─────────────────────────────────────────────

function PolygonSlab({
  polygon,
  yM,
  material,
  faceUp,
}: {
  polygon: FloorPolygon;
  yM: number;
  material: THREE.Material;
  faceUp: boolean;
}) {
  // Geometry contract:
  //   · Input polygon vertices are in world XZ (mm), CCW.
  //   · ShapeGeometry lives in the shape's local XY plane at Z = 0.
  //   · We map polygon (X, Z) → shape (X, Z-as-y) so that a subsequent
  //     rotation of +π/2 around world +X sends local (X, Y, 0) →
  //     world (X, 0, Y) — i.e. polygon Z lands on world Z verbatim.
  //     (The earlier code used -π/2 which sent local Y → world -Y,
  //     mirroring the whole polygon across Z=0 — that was the bug.)
  //
  // Normal direction:
  //   · Rotation +π/2 sends the shape's default +Z normal to world -Y
  //     (facing DOWN). Correct for CEILING.
  //   · For FLOOR we need +Y (facing UP). We flip the normal by
  //     REVERSING the polygon vertex order before feeding it to Shape:
  //     earcut then emits triangles with reversed winding whose
  //     computed normal is -Z (local) → +Y (world) after rotation.
  //
  // Both effects are pure — no scale.negative tricks that would silently
  // corrupt shadow / raycast behavior.
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const raw = polygon.pointsMm;
    if (raw.length < 3) return s;
    const pts = faceUp ? [...raw].reverse() : raw;
    s.moveTo(mmToMeters(pts[0]!.x), mmToMeters(pts[0]!.z));
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(mmToMeters(pts[i]!.x), mmToMeters(pts[i]!.z));
    }
    s.closePath();
    return s;
  }, [polygon, faceUp]);

  return (
    <mesh
      position={[0, yM, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      receiveShadow
      material={material}
    >
      <shapeGeometry args={[shape]} />
    </mesh>
  );
}

// ── Wall renderer ───────────────────────────────────────────────────────

/**
 * Renders every solid segment of one wall. Calls the material hook once
 * per wall (safe because each wall is a distinct component instance) —
 * the material's face size is set to the wall's total length × height so
 * texture tiling matches the wall's real dimensions.
 *
 * Wall placement contract (see shared/wall-render-transform.ts):
 *   The architecture design line IS the interior wall face. This group
 *   sits at the OUTER-corner start (design line + outward normal × FULL
 *   thickness) so that a segment mesh authored with local Z spanning
 *   0..thickness lands at world Z spanning [-T .. 0] — i.e. the wall
 *   body extends OUTWARD only. Cabinets + wall-attached scene assets
 *   placed at wall-local Z = 0 then sit flush with the interior face.
 */
function WallGroup({ wall }: { wall: WallDefinition }) {
  const selection = useMaterialsStore((s) => s.selection);

  const compiled = useMemo(() => compileWall(wall), [wall]);
  const transform = useMemo(() => getWallRenderTransform(wall), [wall]);
  const thicknessM = mmToMeters(wall.thicknessMm);

  const wallMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: transform.lengthMm, heightMm: wall.heightMm },
  });

  return (
    <group
      position={[mmToMeters(transform.originMm.x), 0, mmToMeters(transform.originMm.z)]}
      rotation={[0, transform.rotationY, 0]}
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

const DOOR_SWING_COLOR = "#c8852a";
const DOOR_SWING_Y_M = 0.005;

function DoorSwingOverlay({
  wall,
  door,
}: {
  wall: WallDefinition;
  door: Extract<WallOpening, { type: "door" }>;
}) {
  const geometry = useMemo(() => getDoorSwingGeometry(wall, door), [wall, door]);

  // Convert mm → meter tuples for drei's Line component. The arc + leaf
  // are drawn as two separate polylines so the leaf visually stands out.
  const arcPoints = useMemo(
    () =>
      geometry.arcPointsMm.map(
        (p) => new THREE.Vector3(mmToMeters(p.x), DOOR_SWING_Y_M, mmToMeters(p.z)),
      ),
    [geometry],
  );
  const leafPoints = useMemo(
    () => [
      new THREE.Vector3(
        mmToMeters(geometry.hingeMm.x),
        DOOR_SWING_Y_M,
        mmToMeters(geometry.hingeMm.z),
      ),
      new THREE.Vector3(
        mmToMeters(geometry.leafEndMm.x),
        DOOR_SWING_Y_M,
        mmToMeters(geometry.leafEndMm.z),
      ),
    ],
    [geometry],
  );

  return (
    <group>
      <Line points={arcPoints} color={DOOR_SWING_COLOR} lineWidth={1} />
      <Line points={leafPoints} color={DOOR_SWING_COLOR} lineWidth={1.5} />
    </group>
  );
}

function OpeningOutline({
  wall,
  opening,
}: {
  wall: WallDefinition;
  opening: CompiledOpening;
}) {
  const transform = useMemo(() => getWallRenderTransform(wall), [wall]);
  const widthM = mmToMeters(opening.xEndMm - opening.xStartMm);
  const heightM = mmToMeters(opening.yTopMm - opening.yBottomMm);
  const centerXM = mmToMeters((opening.xStartMm + opening.xEndMm) / 2);
  const centerYM = mmToMeters((opening.yBottomMm + opening.yTopMm) / 2);
  const thicknessM = mmToMeters(wall.thicknessMm);

  // Inside the group, the wall body spans local Z = 0..thickness (with
  // the group anchored at the exterior corner). The interior face is at
  // local Z = thickness. Overlay sits at thickness + epsilon so it hugs
  // the interior face and stays visible from inside the room.
  return (
    <group
      position={[mmToMeters(transform.originMm.x), 0, mmToMeters(transform.originMm.z)]}
      rotation={[0, transform.rotationY, 0]}
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

// ── Window frame / mullion overlay ──────────────────────────────────────

const WINDOW_FRAME_COLOR = "#6ab5c8";
// Small positive wall-local Z = a hair INTO the room past the interior
// face — avoids z-fighting with the wall interior. Under the domain
// convention wall-local Z = 0 IS the interior face (see wall-render-transform.ts).
const WINDOW_FRAME_Z_OFFSET_MM = 5;

function WindowFrameOverlay({
  wall,
  window: win,
}: {
  wall: WallDefinition;
  window: Extract<WallOpening, { type: "window" }>;
}) {
  const compiled = useMemo(() => compileWall(wall), [wall]);
  const frame = compiled.frame;

  const xStart = Math.max(0, win.offsetMm);
  const xEnd = Math.min(frame.lengthMm, win.offsetMm + win.widthMm);
  const yBot = Math.max(0, win.sillHeightMm);
  const yTop = Math.min(wall.heightMm, win.sillHeightMm + win.heightMm);

  const cornersLocal = [
    { xMm: xStart, yMm: yBot, zMm: WINDOW_FRAME_Z_OFFSET_MM },
    { xMm: xEnd, yMm: yBot, zMm: WINDOW_FRAME_Z_OFFSET_MM },
    { xMm: xEnd, yMm: yTop, zMm: WINDOW_FRAME_Z_OFFSET_MM },
    { xMm: xStart, yMm: yTop, zMm: WINDOW_FRAME_Z_OFFSET_MM },
    { xMm: xStart, yMm: yBot, zMm: WINDOW_FRAME_Z_OFFSET_MM },
  ];
  const framePts = useMemo(
    () =>
      cornersLocal.map((p) => {
        const w = wallLocalToWorld(frame, p);
        return new THREE.Vector3(mmToMeters(w.x), mmToMeters(w.y), mmToMeters(w.z));
      }),
    [frame, cornersLocal],
  );

  // Mullion at the center for wide windows — simple architectural hint.
  const showMullion = xEnd - xStart > 900;
  const xMid = (xStart + xEnd) / 2;
  const mullionPts = useMemo(() => {
    if (!showMullion) return null;
    const a = wallLocalToWorld(frame, {
      xMm: xMid,
      yMm: yBot,
      zMm: WINDOW_FRAME_Z_OFFSET_MM,
    });
    const b = wallLocalToWorld(frame, {
      xMm: xMid,
      yMm: yTop,
      zMm: WINDOW_FRAME_Z_OFFSET_MM,
    });
    return [
      new THREE.Vector3(mmToMeters(a.x), mmToMeters(a.y), mmToMeters(a.z)),
      new THREE.Vector3(mmToMeters(b.x), mmToMeters(b.y), mmToMeters(b.z)),
    ];
  }, [showMullion, frame, xMid, yBot, yTop]);

  return (
    <group>
      <Line points={framePts} color={WINDOW_FRAME_COLOR} lineWidth={1.5} />
      {mullionPts && (
        <Line points={mullionPts} color={WINDOW_FRAME_COLOR} lineWidth={1} />
      )}
    </group>
  );
}

// ── Selected-wall dimension callouts ────────────────────────────────────

const DIM_COLOR = "#c8852a";

function SelectedWallDimensions({
  architecture,
}: {
  architecture: { walls: WallDefinition[] };
}) {
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedOpeningId = useEditorStore((s) => s.selectedOpeningId);
  const wall = selectedWallId
    ? architecture.walls.find((w) => w.id === selectedWallId)
    : undefined;
  if (!wall) return null;
  const midX = (wall.startMm.x + wall.endMm.x) / 2;
  const midZ = (wall.startMm.z + wall.endMm.z) / 2;
  const length = Math.round(
    Math.hypot(wall.endMm.x - wall.startMm.x, wall.endMm.z - wall.startMm.z),
  );

  // Extra callouts for the selected opening (if any).
  const selectedOpening = selectedOpeningId
    ? wall.openings.find((o) => o.id === selectedOpeningId)
    : undefined;

  return (
    <group>
      <Html
        position={[mmToMeters(midX), mmToMeters(wall.heightMm) + 0.2, mmToMeters(midZ)]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            color: DIM_COLOR,
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            background: "rgba(15, 17, 20, 0.85)",
            border: "1px solid #6a5828",
            padding: "2px 6px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          {wall.id} · {length} mm · h {wall.heightMm} · t {wall.thicknessMm}
        </div>
      </Html>
      {selectedOpening && (
        <Html
          position={[
            mmToMeters(midX),
            mmToMeters(wall.heightMm) + 0.5,
            mmToMeters(midZ),
          ]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              color: DIM_COLOR,
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              background: "rgba(15, 17, 20, 0.85)",
              border: "1px solid #6a5828",
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}
          >
            {selectedOpening.type} · offset {selectedOpening.offsetMm} · {selectedOpening.widthMm} × {selectedOpening.heightMm} mm
          </div>
        </Html>
      )}
    </group>
  );
}

