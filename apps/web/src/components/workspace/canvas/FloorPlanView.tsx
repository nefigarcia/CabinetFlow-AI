"use client";

import { useMemo } from "react";
import {
  buildCabinetRuns,
  compileArchitecture,
  extractFloorPolygon,
  getDoorSwingGeometry,
  getRoomArchitecture,
  getWallFrame,
  polygonAabb,
  resolveCabinetWorldPosition,
  wallLocalToWorld,
  type Room,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";

// 2D floor-plan view — pure SVG, no R3F. Consumes the SAME architecture
// compiler as the 3D renderer so the two views can't disagree.
//
// Layout:
//   · viewBox scaled to the polygon AABB + padding
//   · wall centerlines drawn as strokes; thickness bands drawn as thin
//     parallel strokes for context
//   · openings render as GAPS (the wall band skips the opening range);
//     doors additionally get a swing arc + leaf line overlay
//   · selected wall highlighted in brand orange; click to select
//   · dimension label on each wall (length in mm)
//
// Scale is auto-fit — the SVG preserves aspect ratio via viewBox.

interface Props {
  room: Room;
}

const PADDING_MM = 500;
const WALL_STROKE = "#7a7a7a";
const WALL_STROKE_SELECTED = "#c8852a";
const OPENING_COLOR: Record<"door" | "window" | "opening", string> = {
  door: "#c8852a",
  window: "#6ab5c8",
  opening: "#9a9288",
};
const DIM_COLOR = "#8a8080";

export function FloorPlanView({ room }: Props) {
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectWall = useEditorStore((s) => s.selectWall);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const cabinets = useEditorStore((s) => s.cabinets);

  const architecture = useMemo(
    () =>
      getRoomArchitecture({
        metadata: room.metadata ?? null,
        width: Number(room.width),
        height: Number(room.height),
        depth: Number(room.depth),
      }),
    [room],
  );

  const polygon = useMemo(() => extractFloorPolygon(architecture), [architecture]);
  const bounds = useMemo(() => (polygon ? polygonAabb(polygon) : null), [polygon]);
  const compiled = useMemo(() => compileArchitecture(architecture), [architecture]);

  // Cabinets grouped by wall. For each item, resolve the 4 world-XZ
  // corners of the footprint so we can render as a polygon regardless
  // of the wall's angle.
  const cabinetFootprints = useMemo(() => {
    const runs = buildCabinetRuns({
      cabinets: cabinets.filter((c) => c.roomId === room.id),
      walls: architecture.walls,
    });
    const out: {
      id: string;
      name: string;
      isSelected: boolean;
      cornersWorld: Array<{ x: number; z: number }>;
    }[] = [];
    for (const run of runs) {
      const frame = getWallFrame(run.wall);
      for (const it of run.items) {
        const w = Number(it.cabinet.width);
        const d = Number(it.cabinet.depth);
        const corners = [
          wallLocalToWorld(frame, { xMm: it.placement.offsetMm, yMm: 0, zMm: 0 }),
          wallLocalToWorld(frame, { xMm: it.placement.offsetMm + w, yMm: 0, zMm: 0 }),
          wallLocalToWorld(frame, { xMm: it.placement.offsetMm + w, yMm: 0, zMm: d }),
          wallLocalToWorld(frame, { xMm: it.placement.offsetMm, yMm: 0, zMm: d }),
        ].map((c) => ({ x: c.x, z: c.z }));
        out.push({
          id: it.cabinetId,
          name: it.cabinet.name,
          isSelected: it.cabinetId === selectedCabinetId,
          cornersWorld: corners,
        });
      }
    }
    // Also plot free cabinets by their world posX/Y/Z rectangle.
    for (const c of cabinets.filter((c) => c.roomId === room.id)) {
      const wall = architecture.walls.some((w) =>
        (c.parameters as { wallPlacement?: { wallId: string } })?.wallPlacement?.wallId === w.id,
      );
      if (wall) continue;
      out.push({
        id: c.id,
        name: c.name,
        isSelected: c.id === selectedCabinetId,
        cornersWorld: [
          { x: c.posX, z: c.posZ },
          { x: c.posX + Number(c.width), z: c.posZ },
          { x: c.posX + Number(c.width), z: c.posZ + Number(c.depth) },
          { x: c.posX, z: c.posZ + Number(c.depth) },
        ],
      });
    }
    void resolveCabinetWorldPosition;
    return out;
  }, [cabinets, architecture, room.id, selectedCabinetId]);

  if (!bounds || !polygon) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
        Not enough walls to draw a floor plan.
      </div>
    );
  }

  const minX = bounds.min.x - PADDING_MM;
  const minZ = bounds.min.z - PADDING_MM;
  const w = bounds.max.x - bounds.min.x + PADDING_MM * 2;
  const h = bounds.max.z - bounds.min.z + PADDING_MM * 2;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0f1114]">
      <svg
        viewBox={`${minX} ${minZ} ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ maxHeight: "100%" }}
      >
        {/* Room polygon fill — subtle backdrop */}
        <polygon
          points={polygon.pointsMm.map((p) => `${p.x},${p.z}`).join(" ")}
          fill="#141519"
          stroke="none"
        />

        {/* Walls */}
        {compiled.map((cw) => {
          const wall = architecture.walls.find((w) => w.id === cw.wallId)!;
          const isSelected = wall.id === selectedWallId;
          const stroke = isSelected ? WALL_STROKE_SELECTED : WALL_STROKE;
          // Solid segments in world XZ, in the wall's local X band. We
          // convert each compiled segment's [xStartMm, xEndMm] to world
          // XZ by parameterizing along the wall.
          return (
            <g key={wall.id}>
              {cw.segments.map((seg, i) => {
                const t0 = seg.xStartMm / cw.frame.lengthMm;
                const t1 = seg.xEndMm / cw.frame.lengthMm;
                const x0 = wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t0;
                const z0 = wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t0;
                const x1 = wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t1;
                const z1 = wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t1;
                return (
                  <line
                    key={i}
                    x1={x0}
                    y1={z0}
                    x2={x1}
                    y2={z1}
                    stroke={stroke}
                    strokeWidth={wall.thicknessMm}
                    strokeLinecap="butt"
                    onClick={() => selectWall(wall.id)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}

              {/* Opening markers — colored line across the opening gap. */}
              {cw.openings.map((op) => {
                const t0 = op.xStartMm / cw.frame.lengthMm;
                const t1 = op.xEndMm / cw.frame.lengthMm;
                const x0 = wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t0;
                const z0 = wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t0;
                const x1 = wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t1;
                const z1 = wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t1;
                return (
                  <line
                    key={op.openingId}
                    x1={x0}
                    y1={z0}
                    x2={x1}
                    y2={z1}
                    stroke={OPENING_COLOR[op.type]}
                    strokeWidth={Math.max(30, wall.thicknessMm * 0.6)}
                    strokeLinecap="butt"
                  />
                );
              })}

              {/* Door swing arcs. */}
              {wall.openings
                .filter((op) => op.type === "door")
                .map((door) => {
                  const swing = getDoorSwingGeometry(wall, door);
                  const arcPath =
                    "M " +
                    swing.arcPointsMm.map((p) => `${p.x},${p.z}`).join(" L ") +
                    "";
                  return (
                    <g key={`${door.id}:swing`} stroke={OPENING_COLOR.door} fill="none">
                      <path d={arcPath} strokeWidth={20} />
                      <line
                        x1={swing.hingeMm.x}
                        y1={swing.hingeMm.z}
                        x2={swing.leafEndMm.x}
                        y2={swing.leafEndMm.z}
                        strokeWidth={30}
                      />
                    </g>
                  );
                })}
            </g>
          );
        })}

        {/* Cabinet footprints — wall-attached AND free. Click to select. */}
        {cabinetFootprints.map((fp) => (
          <polygon
            key={`cab:${fp.id}`}
            points={fp.cornersWorld.map((c) => `${c.x},${c.z}`).join(" ")}
            fill={fp.isSelected ? "rgba(200, 133, 42, 0.20)" : "rgba(100, 110, 130, 0.20)"}
            stroke={fp.isSelected ? "#c8852a" : "#4a5060"}
            strokeWidth={fp.isSelected ? 30 : 15}
            onClick={() => selectCabinet(fp.id)}
            style={{ cursor: "pointer" }}
          >
            <title>{fp.name}</title>
          </polygon>
        ))}

        {/* Dimension labels — one per wall, at the midpoint. */}
        {architecture.walls.map((wall) => {
          const midX = (wall.startMm.x + wall.endMm.x) / 2;
          const midZ = (wall.startMm.z + wall.endMm.z) / 2;
          const length = Math.round(
            Math.hypot(wall.endMm.x - wall.startMm.x, wall.endMm.z - wall.startMm.z),
          );
          return (
            <text
              key={`dim:${wall.id}`}
              x={midX}
              y={midZ}
              fill={DIM_COLOR}
              fontSize={100}
              textAnchor="middle"
              alignmentBaseline="middle"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {length} mm
            </text>
          );
        })}
      </svg>
    </div>
  );
}
