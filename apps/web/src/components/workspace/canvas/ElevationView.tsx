"use client";

import { useMemo } from "react";
import {
  buildCabinetRuns,
  detectRunGaps,
  getApplianceExtentsOnWall,
  getRemainingWallSpace,
  getRoomArchitecture,
  getWallElevationGeometry,
  type Cabinet,
  type Room,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";

// Elevation view — SVG projection of a SINGLE selected wall.
//
// Consumes the shared `getWallElevationGeometry` adapter so the 2D and
// 3D views can't drift out of sync. The wall lays flat in the view with
// wall-local X on horizontal and Y (floor→ceiling) inverted onto SVG's
// top-down Y so the ceiling appears at the top of the frame.
//
// Content:
//   · solid segments as filled rectangles (medium gray)
//   · openings as inset rectangles colored per type (door / window /
//     generic) with the head + sill lines called out
//   · window "mullion" hint — a single vertical line at the window center
//     when width > 900 mm
//   · dimension labels: overall wall length + selected opening extents

const PADDING_MM = 300;
const WALL_FILL = "#22262e";
const WALL_STROKE = "#4a4f5a";
const OPENING_COLOR: Record<"door" | "window" | "opening", string> = {
  door: "#c8852a",
  window: "#6ab5c8",
  opening: "#9a9288",
};

interface Props {
  room: Room;
}

const CABINET_FILL = "#2a2f3a";
const CABINET_STROKE = "#4a5060";
const CABINET_STROKE_SELECTED = "#c8852a";

export function ElevationView({ room }: Props) {
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const cabinets = useEditorStore((s) => s.cabinets);
  const sceneInstances = useSceneAssetsStore((s) => s.instances);
  const sceneDefs = useSceneAssetsStore((s) => s.definitions);

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

  const wall = useMemo(
    () =>
      selectedWallId
        ? architecture.walls.find((w) => w.id === selectedWallId)
        : architecture.walls[0],
    [architecture, selectedWallId],
  );

  const runsByWall = useMemo(
    () =>
      buildCabinetRuns({
        cabinets: cabinets.filter((c) => c.roomId === room.id),
        walls: architecture.walls,
      }),
    [cabinets, architecture, room.id],
  );

  const applianceExtents = useMemo(() => {
    if (!wall) return [];
    const scene = sceneInstances
      .filter((i) => i.roomId === room.id)
      .map((instance) => {
        const definition = sceneDefs.find((d) => d.id === instance.assetDefinitionId);
        return definition ? { instance, definition } : null;
      })
      .filter((v): v is { instance: (typeof sceneInstances)[number]; definition: (typeof sceneDefs)[number] } => v !== null);
    return getApplianceExtentsOnWall({ wall, sceneAssets: scene });
  }, [wall, sceneInstances, sceneDefs, room.id]);

  const runOnThisWall = useMemo(
    () => (wall ? runsByWall.find((r) => r.wallId === wall.id) ?? null : null),
    [runsByWall, wall],
  );

  const remaining = useMemo(() => {
    if (!wall) return null;
    return getRemainingWallSpace({
      wall,
      run: runOnThisWall,
      openings: wall.openings,
      applianceExtents,
    });
  }, [wall, runOnThisWall, applianceExtents]);

  const gaps = useMemo(
    () =>
      runOnThisWall && wall
        ? detectRunGaps({
            run: runOnThisWall,
            openings: wall.openings,
            applianceExtents,
          })
        : [],
    [runOnThisWall, wall, applianceExtents],
  );

  if (!wall) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
        No walls to show. Draw or add a wall from the Architecture panel.
      </div>
    );
  }

  const elevation = getWallElevationGeometry(wall);
  const viewW = elevation.widthMm + PADDING_MM * 2;
  const viewH = elevation.heightMm + PADDING_MM * 2;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0f1114]">
      <p className="text-gray-500 text-[11px] mb-1">
        Elevation · {wall.id} · {Math.round(elevation.widthMm)} × {Math.round(elevation.heightMm)} mm
      </p>
      {remaining && (
        <p className="text-[10px] mb-2 tabular-nums">
          <span className="text-gray-500">Cabinets </span>
          <span className="text-gray-300">{Math.round(remaining.cabinetsWidthMm)} mm</span>
          <span className="text-gray-500"> · Remaining </span>
          <span style={{ color: remaining.remainingMm < 0 ? "#e07070" : "#c8852a" }}>
            {Math.round(remaining.remainingMm)} mm
          </span>
        </p>
      )}
      <svg
        viewBox={`${-PADDING_MM} ${-PADDING_MM} ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Wall backdrop */}
        <rect
          x={0}
          y={0}
          width={elevation.widthMm}
          height={elevation.heightMm}
          fill="#141519"
          stroke={WALL_STROKE}
          strokeWidth={20}
        />

        {/* Solid segments — floor(Y=0) at BOTTOM of the SVG so we invert
            the Y coordinate: svgY = wall.heightMm - yTopMm. */}
        {elevation.segments.map((seg, i) => {
          const svgX = seg.xStartMm;
          const svgY = elevation.heightMm - seg.yTopMm;
          const w = seg.xEndMm - seg.xStartMm;
          const h = seg.yTopMm - seg.yBottomMm;
          return (
            <rect
              key={i}
              x={svgX}
              y={svgY}
              width={w}
              height={h}
              fill={WALL_FILL}
              stroke={WALL_STROKE}
              strokeWidth={10}
            />
          );
        })}

        {/* Openings — colored rectangles with a mullion for wide windows. */}
        {elevation.openings.map((op) => {
          const svgX = op.xStartMm;
          const svgY = elevation.heightMm - op.yTopMm;
          const w = op.xEndMm - op.xStartMm;
          const h = op.yTopMm - op.yBottomMm;
          const color = OPENING_COLOR[op.type];
          return (
            <g key={op.openingId} stroke={color} fill="none">
              <rect x={svgX} y={svgY} width={w} height={h} strokeWidth={30} />
              {op.type === "window" && w > 900 && (
                <line
                  x1={svgX + w / 2}
                  y1={svgY}
                  x2={svgX + w / 2}
                  y2={svgY + h}
                  strokeWidth={20}
                />
              )}
              {/* Head + sill callout lines (short ticks along the wall
                  above/below the opening) — useful in elevation drawings. */}
              <line
                x1={svgX}
                y1={svgY}
                x2={svgX + w}
                y2={svgY}
                strokeWidth={10}
                strokeDasharray="40 40"
              />
              <line
                x1={svgX}
                y1={svgY + h}
                x2={svgX + w}
                y2={svgY + h}
                strokeWidth={10}
                strokeDasharray="40 40"
              />
              <text
                x={svgX + w / 2}
                y={svgY - 50}
                fill={color}
                fontSize={80}
                textAnchor="middle"
                style={{ userSelect: "none" }}
              >
                {op.type} · {Math.round(w)} × {Math.round(h)} mm
              </text>
            </g>
          );
        })}

        {/* Cabinet fronts — read from the run on this wall. Selecting a
            front selects the cabinet (same underlying store selection
            used by 3D + inspector). */}
        {runOnThisWall?.items.map((item) => {
          const w = Number(item.cabinet.width);
          const h = Number(item.cabinet.height);
          const svgX = item.placement.offsetMm;
          const svgY = elevation.heightMm - (item.placement.baseElevationMm + h);
          const isSelected = item.cabinetId === selectedCabinetId;
          return (
            <CabinetFront
              key={item.cabinetId}
              cabinet={item.cabinet}
              x={svgX}
              y={svgY}
              width={w}
              height={h}
              isSelected={isSelected}
              onSelect={() => selectCabinet(item.cabinetId)}
            />
          );
        })}

        {/* Gap markers on the floor line (only unassigned / large ones). */}
        {gaps
          .filter((g) => g.kind === "unassigned" || g.kind === "filler")
          .map((g, i) => (
            <g key={`gap:${i}`}>
              <line
                x1={g.startMm}
                y1={elevation.heightMm - 20}
                x2={g.endMm}
                y2={elevation.heightMm - 20}
                stroke={g.kind === "unassigned" ? "#c8852a" : "#8a8080"}
                strokeWidth={30}
                strokeLinecap="butt"
              />
              <text
                x={(g.startMm + g.endMm) / 2}
                y={elevation.heightMm - 80}
                fill={g.kind === "unassigned" ? "#c8852a" : "#8a8080"}
                fontSize={70}
                textAnchor="middle"
                style={{ userSelect: "none" }}
              >
                {g.kind === "unassigned" ? "gap " : "filler "}
                {Math.round(g.widthMm)} mm
              </text>
            </g>
          ))}
      </svg>
    </div>
  );
}

function CabinetFront({
  cabinet,
  x,
  y,
  width,
  height,
  isSelected,
  onSelect,
}: {
  cabinet: Cabinet;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const params = (cabinet.parameters ?? {}) as {
    doorCount?: number;
    drawerCount?: number;
  };
  const doors = Math.max(0, Math.floor(params.doorCount ?? 0));
  const drawers = Math.max(0, Math.floor(params.drawerCount ?? 0));

  return (
    <g
      onClick={onSelect}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={cabinet.name}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CABINET_FILL}
        stroke={isSelected ? CABINET_STROKE_SELECTED : CABINET_STROKE}
        strokeWidth={isSelected ? 30 : 15}
      />
      {/* Drawer bank at the top */}
      {drawers > 0 &&
        Array.from({ length: drawers }).map((_, i) => (
          <line
            key={`d:${i}`}
            x1={x}
            y1={y + ((i + 1) * height) / (drawers + Math.max(doors, 1))}
            x2={x + width}
            y2={y + ((i + 1) * height) / (drawers + Math.max(doors, 1))}
            stroke={CABINET_STROKE}
            strokeWidth={10}
          />
        ))}
      {/* Door split at center for double doors */}
      {doors === 2 && (
        <line
          x1={x + width / 2}
          y1={y + (drawers * height) / (drawers + doors + 0.0001)}
          x2={x + width / 2}
          y2={y + height}
          stroke={CABINET_STROKE}
          strokeWidth={10}
        />
      )}
      {/* Width label */}
      <text
        x={x + width / 2}
        y={y - 30}
        fill={isSelected ? CABINET_STROKE_SELECTED : "#8a8080"}
        fontSize={70}
        textAnchor="middle"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {Math.round(width)} mm
      </text>
    </g>
  );
}
