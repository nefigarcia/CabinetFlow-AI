"use client";

import { useMemo, useState } from "react";
import {
  CABINET_CATEGORIES,
  CABINET_LIBRARY,
  buildCabinetRuns,
  chainAppendRight,
  chainAppendLeft,
  filterLibraryByCategory,
  getCabinetLibraryEntry,
  getRoomArchitecture,
  isFloorMountedCabinetType,
  isWallMountedCabinetType,
  searchLibrary,
  withCabinetWallPlacement,
  DEFAULT_WALL_CABINET_ELEVATION_MM,
  type CabinetCategory,
  type CabinetLibraryEntry,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";
import { useCabinets } from "@/hooks/useCabinets";
import { resolveCabinetWorldPosition } from "@woodcraft/shared";

// Cabinet Library panel — quick-add + chain workflow.
//
// Design goals:
//   · Categories map to real cabinet types (base, wall, tall, drawer,
//     sink, corner, appliance, open, custom) — no parallel type system.
//   · Width presets + a Custom numeric input per entry. Widths are mm.
//   · Add Right / Add Left chain against the selected wall's run. The
//     new cabinet's offset is COMPUTED deterministically via the shared
//     run-operations module — never guessed by the UI.
//   · Wall-mounted definitions require an EXPLICIT selectedWallId (same
//     policy as scene assets). Floor-mounted also require a selected wall
//     — the whole quick-add flow is wall-oriented.

interface Props {
  projectId: string;
}

type CategoryFilter = CabinetCategory | "all";

export function CabinetLibraryPanel({ projectId }: Props) {
  const rooms = useEditorStore((s) => s.rooms);
  const cabinets = useEditorStore((s) => s.cabinets);
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const { create, save, saving } = useCabinets(projectId);

  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [placingEntryId, setPlacingEntryId] = useState<string | null>(null);
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({});

  const room = rooms.find((r) => r.id === selectedRoomId);
  const architecture = useMemo(
    () =>
      room
        ? getRoomArchitecture({
            metadata: room.metadata ?? null,
            width: Number(room.width),
            height: Number(room.height),
            depth: Number(room.depth),
          })
        : null,
    [room],
  );

  const selectedWall = useMemo(
    () =>
      architecture && selectedWallId
        ? architecture.walls.find((w) => w.id === selectedWallId)
        : undefined,
    [architecture, selectedWallId],
  );

  const filtered = useMemo(
    () => filterLibraryByCategory(CABINET_LIBRARY, filter),
    [filter],
  );
  const results = useMemo(() => searchLibrary(filtered, query), [filtered, query]);

  // The current wall's run — the base for chain operations.
  const currentRun = useMemo(() => {
    if (!architecture || !selectedWall) return null;
    const runs = buildCabinetRuns({ cabinets, walls: architecture.walls });
    return runs.find((r) => r.wallId === selectedWall.id) ?? null;
  }, [architecture, selectedWall, cabinets]);

  const canPlace = Boolean(room && architecture && selectedWall);

  const widthFor = (entry: CabinetLibraryEntry): number =>
    widthOverrides[entry.id] ?? entry.defaultWidthMm;

  async function place(
    entry: CabinetLibraryEntry,
    direction: "right" | "left",
  ): Promise<void> {
    if (!room || !architecture || !selectedWall) {
      setError("Select a wall in the Architecture panel first.");
      return;
    }
    if (isWallMountedCabinetType(entry.type)) {
      // OK — install height gets DEFAULT_WALL_CABINET_ELEVATION_MM via
      // defaultBaseElevationMm() inside the chain helper.
    } else if (!isFloorMountedCabinetType(entry.type)) {
      setError(`Entry "${entry.name}" is neither floor- nor wall-mounted.`);
      return;
    }

    const w = widthFor(entry);
    setPlacingEntryId(entry.id);
    setError(null);
    try {
      // 1) Compute the new placement + any downstream shift.
      const runForChain =
        currentRun ?? { wallId: selectedWall.id, wall: selectedWall, items: [] };
      const chain =
        direction === "right"
          ? chainAppendRight({
              run: runForChain,
              newCabinetWidthMm: w,
              newCabinetType: entry.type,
              wall: selectedWall,
            })
          : chainAppendLeft({
              run: runForChain,
              newCabinetWidthMm: w,
              newCabinetType: entry.type,
              wall: selectedWall,
            });

      if (!chain.fitsWithinWall) {
        setError(
          `Cabinet doesn't fit on "${selectedWall.id}" — chain would extend past the wall end.`,
        );
        return;
      }

      // 2) If Add Left required a shift, PATCH every existing cabinet
      //    first so the persisted state stays consistent.
      const shiftMm = direction === "left" && "shiftMm" in chain ? (chain as { shiftMm: number }).shiftMm : 0;
      if (direction === "left" && shiftMm > 0) {
        for (const item of runForChain.items) {
          const newOffset = item.placement.offsetMm + shiftMm;
          const newPlacement = { ...item.placement, offsetMm: newOffset };
          const world = resolveCabinetWorldPosition({
            placement: newPlacement,
            architecture,
            widthMm: Number(item.cabinet.width),
            depthMm: Number(item.cabinet.depth),
          });
          await save(item.cabinetId, {
            parameters: withCabinetWallPlacement(item.cabinet.parameters, newPlacement),
            posX: world?.posX,
            posY: world?.posY,
            posZ: world?.posZ,
          });
        }
      }

      // 3) Create the new cabinet with resolved world position + wall
      //    attachment persisted in parameters.
      const world = resolveCabinetWorldPosition({
        placement: chain.placement,
        architecture,
        widthMm: w,
        depthMm: entry.defaultDepthMm,
      });
      await create({
        type: entry.type,
        name: entry.name,
        width: w,
        height: entry.defaultHeightMm,
        depth: entry.defaultDepthMm,
        posX: world?.posX ?? 0,
        posY: world?.posY ?? 0,
        posZ: world?.posZ ?? 0,
        parameters: withCabinetWallPlacement({}, chain.placement),
      });
    } finally {
      setPlacingEntryId(null);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category strip */}
      <div className="px-2 pt-2 pb-1.5 flex flex-wrap gap-1">
        <FilterChip
          label="All"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {CABINET_CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            label={capitalize(c)}
            active={filter === c}
            onClick={() => setFilter(c)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="px-2 pb-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cabinets…"
          className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Ready-state hints */}
      {!canPlace && (
        <div
          className="mx-2 mb-1.5 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(150, 120, 60, 0.10)",
            border: "1px solid #4a3d20",
            color: "#c8a86a",
          }}
        >
          {room
            ? "Select a wall to chain cabinets — click a wall in the Architecture tab or 2D floor plan."
            : "Select a room to add cabinets."}
        </div>
      )}
      {canPlace && selectedWall && (
        <p className="mx-2 mb-1.5 text-[10px] text-gray-500 tabular-nums">
          Chaining onto <span className="text-gray-300">{selectedWall.id}</span>
          {currentRun ? ` · ${currentRun.items.length} cabinet(s)` : " · empty"}
          {selectedCabinetId ? ` · selected: ${selectedCabinetId}` : ""}
        </p>
      )}

      {error && (
        <div
          className="mx-2 mb-1.5 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(220, 60, 60, 0.10)",
            border: "1px solid #6a2828",
            color: "#e07070",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-gray-500 hover:text-white text-xs leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-auto px-2 pb-2 space-y-1.5">
        {results.length === 0 ? (
          <p className="text-xs text-gray-600 px-1 mt-3">No cabinets match.</p>
        ) : (
          results.map((entry) => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              disabled={!canPlace || saving || placingEntryId !== null}
              placing={placingEntryId === entry.id}
              widthMm={widthFor(entry)}
              onWidthChange={(v) =>
                setWidthOverrides((prev) => ({ ...prev, [entry.id]: v }))
              }
              onAddRight={() => void place(entry, "right")}
              onAddLeft={() => void place(entry, "left")}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2 py-0.5 text-[11px] transition-colors"
      style={{
        background: active ? "#c8852a" : "#1A1E26",
        border: active ? "1px solid #c8852a" : "1px solid #2E3240",
        color: active ? "#fff" : "#9A9288",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#9A9288";
      }}
    >
      {label}
    </button>
  );
}

function LibraryCard({
  entry,
  disabled,
  placing,
  widthMm,
  onWidthChange,
  onAddRight,
  onAddLeft,
}: {
  entry: CabinetLibraryEntry;
  disabled: boolean;
  placing: boolean;
  widthMm: number;
  onWidthChange: (v: number) => void;
  onAddRight: () => void;
  onAddLeft: () => void;
}) {
  return (
    <div
      className="rounded-md p-2"
      style={{ background: "#141519", border: "1px solid #2E3240" }}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md text-base"
          style={{
            background: "#1A1E26",
            border: "1px solid #2E3240",
            color: "#c8852a",
          }}
        >
          {CATEGORY_GLYPH[entry.category]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-white text-xs font-medium truncate">{entry.name}</p>
          <p className="text-[10px] text-gray-500 truncate">
            {entry.type} · {entry.defaultHeightMm}H × {entry.defaultDepthMm}D mm
            {entry.type === "wall"
              ? ` · install at ${DEFAULT_WALL_CABINET_ELEVATION_MM} mm`
              : ""}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-gray-600 leading-snug">{entry.description}</p>

      {/* Width presets + custom */}
      <div className="mt-2 flex flex-wrap gap-1">
        {entry.widthPresetsMm.map((w) => (
          <button
            key={w}
            onClick={() => onWidthChange(w)}
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors tabular-nums"
            style={{
              background: widthMm === w ? "#c8852a" : "#1A1E26",
              border: widthMm === w ? "1px solid #c8852a" : "1px solid #2E3240",
              color: widthMm === w ? "#fff" : "#9A9288",
            }}
          >
            {w}
          </button>
        ))}
        <input
          type="number"
          value={widthMm}
          step={10}
          min={100}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) onWidthChange(v);
          }}
          className="text-[10px] bg-surface-100 border border-surface-300 rounded px-1 py-0.5 text-white w-14 tabular-nums text-right"
          title="Custom width (mm)"
        />
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onAddLeft}
          disabled={disabled}
          className="flex-1 text-[11px] py-1 rounded-md transition-colors bg-surface-100 hover:bg-surface-200 disabled:opacity-50 text-gray-200"
        >
          ← Add Left
        </button>
        <button
          onClick={onAddRight}
          disabled={disabled}
          className="flex-1 text-[11px] py-1 rounded-md transition-colors bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white"
        >
          Add Right →
        </button>
      </div>
      {placing && (
        <p className="mt-1 text-[10px] text-gray-500 text-center">saving…</p>
      )}
    </div>
  );
}

const CATEGORY_GLYPH: Record<CabinetCategory, string> = {
  base: "▢",
  wall: "▤",
  tall: "▮",
  drawer: "◫",
  sink: "◇",
  corner: "◭",
  appliance: "◆",
  open: "◪",
  custom: "◈",
};

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
