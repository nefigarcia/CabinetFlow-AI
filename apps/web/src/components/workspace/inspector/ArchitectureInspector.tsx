"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getRoomArchitecture,
  getWallLengthMm,
  validateArchitecture,
  withRoomArchitecture,
  type ArchitectureIssue,
  type CeilingVisibility,
  type Room,
  type RoomArchitecture,
  type WallDefinition,
  type WallOpening,
} from "@woodcraft/shared";
import { apiClient } from "@/lib/api";
import { useEditorStore } from "@/store/editor";

// Architecture Inspector — right-panel content for the Architecture tab.
//
// Reads the current room's architecture (with legacy fallback baked into
// `getRoomArchitecture`), displays wall/opening details for the current
// selection, exposes "Add door / window / opening" actions, and PATCHes
// the room's `metadata.architecture` on change.
//
// Persistence: `Room.metadata` is a JSON blob on the existing `Room` row.
// The Room PATCH route (`apps/api/src/app/api/projects/[id]/rooms/[roomId]`)
// accepts a `metadata` field via `updateRoomSchema`. We compose the full
// merged metadata with `withRoomArchitecture` and send it wholesale — the
// route replaces the JSON, so we must include any other pre-existing
// metadata keys (e.g. `roomType`).

interface Props {
  projectId: string;
  room: Room;
}

const CEILING_VISIBILITY_OPTIONS: readonly {
  value: CeilingVisibility;
  label: string;
}[] = [
  { value: "auto", label: "Auto (hide for interior view)" },
  { value: "visible", label: "Always visible" },
  { value: "hidden", label: "Always hidden" },
];

export function ArchitectureInspector({ projectId, room }: Props) {
  const updateRoom = useEditorStore((s) => s.updateRoom);
  const selectWall = useEditorStore((s) => s.selectWall);
  const selectOpening = useEditorStore((s) => s.selectOpening);
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedOpeningId = useEditorStore((s) => s.selectedOpeningId);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed every render — cheap, and stays synced with the store's
  // room object (which updateRoom mutates on successful PATCH).
  const architecture: RoomArchitecture = useMemo(
    () => getRoomArchitecture(room),
    [room],
  );

  const issues = useMemo(() => validateArchitecture(architecture), [architecture]);

  const selectedWall = selectedWallId
    ? architecture.walls.find((w) => w.id === selectedWallId)
    : undefined;
  const selectedOpening =
    selectedWall && selectedOpeningId
      ? selectedWall.openings.find((o) => o.id === selectedOpeningId)
      : undefined;

  // ── Persistence ──────────────────────────────────────────────────────

  const persistArchitecture = useCallback(
    async (nextArchitecture: RoomArchitecture) => {
      setSaving(true);
      setError(null);
      try {
        const metadata = withRoomArchitecture(room.metadata, nextArchitecture);
        const updated = await apiClient.patch<Room>(
          `/projects/${projectId}/rooms/${room.id}`,
          { metadata },
        );
        // Refresh the store's copy — the room is used by many consumers
        // (renderer, other panels) which read from `useEditorStore.rooms`.
        updateRoom(room.id, { metadata: updated.metadata ?? metadata });
      } catch (e: unknown) {
        console.error("Save architecture failed:", e);
        setError("Couldn't save architecture. Retry your change.");
      } finally {
        setSaving(false);
      }
    },
    [projectId, room.id, room.metadata, updateRoom],
  );

  const mutateArchitecture = useCallback(
    (mutator: (arch: RoomArchitecture) => RoomArchitecture) => {
      const next = mutator(architecture);
      // Fire-and-forget PATCH — the room-level metadata replaces wholesale
      // on the server, so a debounce would still send the same size. We
      // rely on user-driven discrete actions (Add / Delete / edit-numeric-
      // input-blur) rather than per-keystroke edits.
      void persistArchitecture(next);
    },
    [architecture, persistArchitecture],
  );

  // ── Header + validation summary ──────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface-200 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-white text-sm font-semibold truncate">
            Architecture
          </h3>
          <p className="text-gray-500 text-xs">
            {architecture.walls.length} walls · ceiling {architecture.ceiling?.visibility ?? "auto"}
          </p>
        </div>
        {saving && (
          <span className="text-gray-500 text-xs flex-shrink-0">saving…</span>
        )}
      </div>

      {error && (
        <div
          className="mx-3 mt-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(220, 60, 60, 0.10)",
            border: "1px solid #6a2828",
            color: "#e07070",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-5">
        {/* Ceiling visibility */}
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Ceiling visibility
          </p>
          <select
            value={architecture.ceiling?.visibility ?? "auto"}
            onChange={(e) => {
              const v = e.target.value as CeilingVisibility;
              mutateArchitecture((arch) => ({
                ...arch,
                ceiling: { ...arch.ceiling, visibility: v },
              }));
            }}
            className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {CEILING_VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </section>

        {/* Wall list */}
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Walls
          </p>
          <ul className="space-y-0.5">
            {architecture.walls.map((wall) => (
              <li key={wall.id}>
                <button
                  onClick={() => selectWall(wall.id)}
                  className={[
                    "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                    selectedWallId === wall.id
                      ? "bg-brand-500/20 text-brand-400"
                      : "text-gray-400 hover:bg-surface-200 hover:text-white",
                  ].join(" ")}
                >
                  <span className="block font-medium">{wall.id}</span>
                  <span className="block text-[10px] text-gray-600 tabular-nums">
                    {Math.round(getWallLengthMm(wall))} mm long · {wall.openings.length} opening{wall.openings.length === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Wall details */}
        {selectedWall && (
          <WallDetails
            wall={selectedWall}
            onAddDoor={() => addOpening(mutateArchitecture, selectedWall, "door")}
            onAddWindow={() =>
              addOpening(mutateArchitecture, selectedWall, "window")
            }
            onAddOpening={() =>
              addOpening(mutateArchitecture, selectedWall, "opening")
            }
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={(openingId) => selectOpening(selectedWall.id, openingId)}
          />
        )}

        {/* Opening details */}
        {selectedWall && selectedOpening && (
          <OpeningDetails
            wall={selectedWall}
            opening={selectedOpening}
            onChange={(patch) =>
              mutateArchitecture((arch) =>
                patchOpening(arch, selectedWall.id, selectedOpening.id, patch),
              )
            }
            onDelete={() =>
              mutateArchitecture((arch) =>
                deleteOpening(arch, selectedWall.id, selectedOpening.id),
              )
            }
          />
        )}

        {/* Global validation issues */}
        {issues.length > 0 && (
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Issues
              <span className="ml-1 text-gray-600 normal-case">
                ({issues.length} architecture)
              </span>
            </p>
            <ul className="space-y-1">
              {issues.map((issue, idx) => (
                <ArchitectureIssueRow key={idx} issue={issue} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Empty-state helper: no room selected. */
export function ArchitectureInspectorEmpty() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-gray-600 text-xs text-center">
        Select a room to edit its architecture.
      </p>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────

function WallDetails({
  wall,
  onAddDoor,
  onAddWindow,
  onAddOpening,
  selectedOpeningId,
  onSelectOpening,
}: {
  wall: WallDefinition;
  onAddDoor: () => void;
  onAddWindow: () => void;
  onAddOpening: () => void;
  selectedOpeningId: string | null;
  onSelectOpening: (openingId: string) => void;
}) {
  const lengthMm = Math.round(getWallLengthMm(wall));
  return (
    <section>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
        {wall.id}
      </p>
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <ReadonlyStat label="Length" value={`${lengthMm} mm`} />
        <ReadonlyStat label="Height" value={`${wall.heightMm} mm`} />
        <ReadonlyStat label="Thickness" value={`${wall.thicknessMm} mm`} />
      </div>
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={onAddDoor}
          className="flex-1 text-xs bg-surface-100 hover:bg-surface-200 text-gray-200 py-1 rounded-md transition-colors"
        >
          + Door
        </button>
        <button
          onClick={onAddWindow}
          className="flex-1 text-xs bg-surface-100 hover:bg-surface-200 text-gray-200 py-1 rounded-md transition-colors"
        >
          + Window
        </button>
        <button
          onClick={onAddOpening}
          className="flex-1 text-xs bg-surface-100 hover:bg-surface-200 text-gray-200 py-1 rounded-md transition-colors"
        >
          + Opening
        </button>
      </div>

      {wall.openings.length === 0 ? (
        <p className="text-[10px] text-gray-600">No openings on this wall.</p>
      ) : (
        <ul className="space-y-0.5">
          {wall.openings.map((op) => (
            <li key={op.id}>
              <button
                onClick={() => onSelectOpening(op.id)}
                className={[
                  "w-full text-left px-2 py-1 rounded text-[11px] transition-colors",
                  selectedOpeningId === op.id
                    ? "bg-brand-500/20 text-brand-400"
                    : "text-gray-400 hover:bg-surface-200 hover:text-white",
                ].join(" ")}
              >
                <span className="capitalize font-medium">{op.type}</span>
                <span className="ml-1 text-gray-500 tabular-nums">
                  · offset {op.offsetMm} mm · {op.widthMm} × {op.heightMm} mm
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OpeningDetails({
  wall,
  opening,
  onChange,
  onDelete,
}: {
  wall: WallDefinition;
  opening: WallOpening;
  onChange: (patch: Partial<WallOpening>) => void;
  onDelete: () => void;
}) {
  const isWindow = opening.type === "window";
  const isGenericWithSill = opening.type === "opening";

  return (
    <section>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2 capitalize">
        {opening.type} details
      </p>
      <div className="space-y-2">
        <NumberInput
          label="Offset along wall"
          unit="mm"
          value={opening.offsetMm}
          onChange={(v) => onChange({ offsetMm: v } as Partial<WallOpening>)}
        />
        <NumberInput
          label="Width"
          unit="mm"
          value={opening.widthMm}
          onChange={(v) => onChange({ widthMm: v } as Partial<WallOpening>)}
        />
        <NumberInput
          label="Height"
          unit="mm"
          value={opening.heightMm}
          onChange={(v) => onChange({ heightMm: v } as Partial<WallOpening>)}
        />
        {isWindow && (
          <NumberInput
            label="Sill height"
            unit="mm"
            value={opening.sillHeightMm}
            onChange={(v) => onChange({ sillHeightMm: v } as Partial<WallOpening>)}
          />
        )}
        {isGenericWithSill && (
          <NumberInput
            label="Sill height"
            unit="mm"
            value={opening.sillHeightMm ?? 0}
            onChange={(v) => onChange({ sillHeightMm: v } as Partial<WallOpening>)}
          />
        )}
      </div>
      <button
        onClick={onDelete}
        className="mt-3 w-full text-xs text-red-500 hover:text-red-400 hover:bg-surface-100 py-1 rounded-md transition-colors"
      >
        Delete {opening.type}
      </button>
      <p className="mt-2 text-[10px] text-gray-600">
        Wall {wall.id} · length {Math.round(getWallLengthMm(wall))} mm
      </p>
    </section>
  );
}

function ArchitectureIssueRow({ issue }: { issue: ArchitectureIssue }) {
  const color = issue.severity === "error" ? "#e07070" : "#c8852a";
  const bg =
    issue.severity === "error"
      ? "rgba(220, 60, 60, 0.08)"
      : "rgba(200, 133, 42, 0.08)";
  const border = issue.severity === "error" ? "#6a2828" : "#6a5828";
  return (
    <li
      className="rounded-md px-2 py-1.5 text-[11px] flex items-start gap-1.5"
      style={{ background: bg, border: `1px solid ${border}`, color }}
      title={`source=${issue.source} severity=${issue.severity} code=${issue.code}`}
    >
      <span aria-hidden className="mt-px">
        {issue.severity === "error" ? "✕" : "⚠"}
      </span>
      <span className="min-w-0">{issue.message}</span>
    </li>
  );
}

function ReadonlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-white tabular-nums">{value}</p>
    </div>
  );
}

function NumberInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">
        {label} ({unit})
      </label>
      <input
        type="number"
        value={value}
        step={1}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

// ── Pure state helpers ─────────────────────────────────────────────────

function addOpening(
  mutateArchitecture: (mutator: (arch: RoomArchitecture) => RoomArchitecture) => void,
  wall: WallDefinition,
  type: WallOpening["type"],
) {
  mutateArchitecture((arch) => {
    const wallLength = getWallLengthMm(wall);
    const widthMm = type === "door" ? 900 : type === "window" ? 1200 : 900;
    const heightMm = type === "door" ? 2100 : type === "window" ? 1200 : 2000;
    const offsetMm = Math.max(0, (wallLength - widthMm) / 2);
    const id = generateOpeningId(type, wall);
    const opening: WallOpening =
      type === "door"
        ? { id, type: "door", offsetMm, widthMm, heightMm }
        : type === "window"
          ? { id, type: "window", offsetMm, widthMm, heightMm, sillHeightMm: 900 }
          : { id, type: "opening", offsetMm, widthMm, heightMm };
    return {
      ...arch,
      walls: arch.walls.map((w) =>
        w.id === wall.id ? { ...w, openings: [...w.openings, opening] } : w,
      ),
    };
  });
}

function patchOpening(
  arch: RoomArchitecture,
  wallId: string,
  openingId: string,
  patch: Partial<WallOpening>,
): RoomArchitecture {
  return {
    ...arch,
    walls: arch.walls.map((w) => {
      if (w.id !== wallId) return w;
      return {
        ...w,
        openings: w.openings.map((op) =>
          op.id === openingId ? ({ ...op, ...patch } as WallOpening) : op,
        ),
      };
    }),
  };
}

function deleteOpening(
  arch: RoomArchitecture,
  wallId: string,
  openingId: string,
): RoomArchitecture {
  return {
    ...arch,
    walls: arch.walls.map((w) => {
      if (w.id !== wallId) return w;
      return { ...w, openings: w.openings.filter((op) => op.id !== openingId) };
    }),
  };
}

function generateOpeningId(type: WallOpening["type"], wall: WallDefinition): string {
  const base = `${wall.id}:${type}`;
  const existing = new Set(wall.openings.map((o) => o.id));
  let i = 1;
  while (existing.has(`${base}:${i}`)) i++;
  return `${base}:${i}`;
}
