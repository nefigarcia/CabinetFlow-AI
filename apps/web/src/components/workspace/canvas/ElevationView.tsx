"use client";

import { useMemo } from "react";
import {
  getRoomArchitecture,
  getWallElevationGeometry,
  type Room,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";

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

export function ElevationView({ room }: Props) {
  const selectedWallId = useEditorStore((s) => s.selectedWallId);

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
      <p className="text-gray-500 text-[11px] mb-2">
        Elevation · {wall.id} · {Math.round(elevation.widthMm)} × {Math.round(elevation.heightMm)} mm
      </p>
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
      </svg>
    </div>
  );
}
