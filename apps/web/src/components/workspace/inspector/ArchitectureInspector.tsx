"use client";

import { useCallback, useMemo, useState } from "react";
import {
  deriveDefaultRoomArchitecture,
  getRoomArchitecture,
  getWallLengthMm,
  ROOM_ARCHITECTURE_SCHEMA_VERSION,
  validateArchitecture,
  withRoomArchitecture,
  type ArchitectureIssue,
  type CeilingVisibility,
  type DoorOpening,
  type Room,
  type RoomArchitecture,
  type Vec2Mm,
  type WallDefinition,
  type WallOpening,
} from "@woodcraft/shared";
import { apiClient } from "@/lib/api";
import { useEditorStore } from "@/store/editor";
import { useWorkspaceUiStore } from "../state/use-workspace-ui";

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

/** True when the room's metadata does NOT persist a custom architecture
 *  (i.e. we're rendering the derived rectangular one). Used to gate room-
 *  dimensions editing (which is only correct in legacy mode) and to show
 *  the Convert-to-Custom affordance. */
function isLegacyArchitecture(room: Room): boolean {
  const meta = room.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return true;
  return (meta as Record<string, unknown>).architecture === undefined;
}

export function ArchitectureInspector({ projectId, room }: Props) {
  const updateRoom = useEditorStore((s) => s.updateRoom);
  const selectWall = useEditorStore((s) => s.selectWall);
  const selectOpening = useEditorStore((s) => s.selectOpening);
  const selectedWallId = useEditorStore((s) => s.selectedWallId);
  const selectedOpeningId = useEditorStore((s) => s.selectedOpeningId);

  const drawWallPhase = useWorkspaceUiStore((s) => s.drawWall.phase);
  const startDrawWall = useWorkspaceUiStore((s) => s.startDrawWall);
  const cancelDrawWall = useWorkspaceUiStore((s) => s.cancelDrawWall);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed every render — cheap, and stays synced with the store's
  // room object (which updateRoom mutates on successful PATCH).
  const architecture: RoomArchitecture = useMemo(
    () => getRoomArchitecture(room),
    [room],
  );

  const issues = useMemo(() => validateArchitecture(architecture), [architecture]);

  const legacy = isLegacyArchitecture(room);

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

  // Editing room W/H/D in legacy mode PATCHes the Room row directly
  // (width/height/depth columns), not metadata.architecture — that's the
  // source of truth for the derived rectangular architecture. The
  // renderer/inspector pick up the new dims on the next render via
  // getRoomArchitecture(room).
  const persistRoomDimension = useCallback(
    async (field: "width" | "height" | "depth", value: number) => {
      if (!Number.isFinite(value) || value <= 0) return;
      setSaving(true);
      setError(null);
      try {
        const updated = await apiClient.patch<Room>(
          `/projects/${projectId}/rooms/${room.id}`,
          { [field]: value },
        );
        updateRoom(room.id, { [field]: updated[field] ?? value } as Partial<Room>);
      } catch (e: unknown) {
        console.error("Save room dimension failed:", e);
        setError("Couldn't save room dimension. Retry your change.");
      } finally {
        setSaving(false);
      }
    },
    [projectId, room.id, updateRoom],
  );

  const convertToCustom = useCallback(() => {
    // Snapshot the derived rectangular architecture into metadata.
    // Follow-up wall edits (endpoint/thickness) go through the
    // architecture path from now on.
    void persistArchitecture(deriveDefaultRoomArchitecture(room));
  }, [persistArchitecture, room]);

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
        {/* Room dimensions — editable in legacy mode ONLY. Custom archi-
            tectures edit walls individually via endpoint controls. */}
        {legacy && (
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Room dimensions
              <span className="ml-1 text-gray-600 normal-case">(legacy rectangle)</span>
            </p>
            <div className="space-y-2">
              <NumberInput
                label="Width"
                unit="mm"
                value={Number(room.width)}
                onChange={(v) => void persistRoomDimension("width", v)}
              />
              <NumberInput
                label="Height"
                unit="mm"
                value={Number(room.height)}
                onChange={(v) => void persistRoomDimension("height", v)}
              />
              <NumberInput
                label="Depth"
                unit="mm"
                value={Number(room.depth)}
                onChange={(v) => void persistRoomDimension("depth", v)}
              />
            </div>
            <button
              onClick={convertToCustom}
              className="mt-3 w-full text-xs bg-surface-100 hover:bg-surface-200 text-gray-200 py-1.5 rounded-md transition-colors"
              title="Snapshot the current rectangle into an editable architecture. After conversion, walls become individually editable and the room dimensions section disappears."
            >
              Convert to custom architecture
            </button>
          </section>
        )}

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
          {!legacy && (
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() =>
                  mutateArchitecture((arch) => addWallAfterSelected(arch, selectedWallId))
                }
                className="flex-1 text-xs bg-surface-100 hover:bg-surface-200 text-gray-200 py-1.5 rounded-md transition-colors"
                title="Insert a new wall after the selected wall. Endpoints default to a zero-length stub at the previous wall's end — edit its end point to place it."
              >
                + Add wall
              </button>
              <button
                onClick={() =>
                  drawWallPhase === "idle" ? startDrawWall() : cancelDrawWall()
                }
                className={[
                  "flex-1 text-xs py-1.5 rounded-md transition-colors",
                  drawWallPhase === "idle"
                    ? "bg-surface-100 hover:bg-surface-200 text-gray-200"
                    : "bg-brand-500/20 text-brand-400",
                ].join(" ")}
                title="Draw a wall by clicking two floor points in the 3D view."
              >
                {drawWallPhase === "idle"
                  ? "Draw wall"
                  : drawWallPhase === "awaitStart"
                    ? "Click start · Esc to cancel"
                    : "Click end · Esc to cancel"}
              </button>
            </div>
          )}
        </section>

        {/* Wall details */}
        {selectedWall && (
          <WallDetails
            wall={selectedWall}
            editable={!legacy}
            onAddDoor={() => addOpening(mutateArchitecture, selectedWall, "door")}
            onAddWindow={() =>
              addOpening(mutateArchitecture, selectedWall, "window")
            }
            onAddOpening={() =>
              addOpening(mutateArchitecture, selectedWall, "opening")
            }
            onChange={(patch) =>
              mutateArchitecture((arch) => patchWall(arch, selectedWall.id, patch))
            }
            onDelete={() => {
              mutateArchitecture((arch) => deleteWall(arch, selectedWall.id));
              selectWall(null);
            }}
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
  editable,
  onAddDoor,
  onAddWindow,
  onAddOpening,
  onChange,
  onDelete,
  selectedOpeningId,
  onSelectOpening,
}: {
  wall: WallDefinition;
  editable: boolean;
  onAddDoor: () => void;
  onAddWindow: () => void;
  onAddOpening: () => void;
  onChange: (patch: Partial<WallDefinition>) => void;
  onDelete: () => void;
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

      {editable && (
        <>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Endpoints (mm)
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <NumberInput
              label="Start X"
              unit="mm"
              value={wall.startMm.x}
              onChange={(v) => onChange({ startMm: { ...wall.startMm, x: v } })}
            />
            <NumberInput
              label="Start Z"
              unit="mm"
              value={wall.startMm.z}
              onChange={(v) => onChange({ startMm: { ...wall.startMm, z: v } })}
            />
            <NumberInput
              label="End X"
              unit="mm"
              value={wall.endMm.x}
              onChange={(v) => onChange({ endMm: { ...wall.endMm, x: v } })}
            />
            <NumberInput
              label="End Z"
              unit="mm"
              value={wall.endMm.z}
              onChange={(v) => onChange({ endMm: { ...wall.endMm, z: v } })}
            />
            <NumberInput
              label="Height"
              unit="mm"
              value={wall.heightMm}
              onChange={(v) => onChange({ heightMm: v })}
            />
            <NumberInput
              label="Thickness"
              unit="mm"
              value={wall.thicknessMm}
              onChange={(v) => onChange({ thicknessMm: v })}
            />
          </div>
        </>
      )}

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
      {editable && (
        <button
          onClick={onDelete}
          className="mt-3 w-full text-xs text-red-500 hover:text-red-400 hover:bg-surface-100 py-1.5 rounded-md transition-colors"
          title="Removes this wall. Endpoint continuity of neighboring walls is not auto-repaired; the topology warnings section will flag any resulting gap."
        >
          Delete wall
        </button>
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
  const isDoor = opening.type === "door";
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
        {isDoor && (
          <DoorSwingFields
            door={opening as DoorOpening}
            onChange={onChange}
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

function DoorSwingFields({
  door,
  onChange,
}: {
  door: DoorOpening;
  onChange: (patch: Partial<WallOpening>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Hinge side</label>
        <select
          value={door.hingeSide ?? "left"}
          onChange={(e) =>
            onChange({ hingeSide: e.target.value as "left" | "right" } as Partial<WallOpening>)
          }
          className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Swing</label>
        <select
          value={door.swingDirection ?? "inward"}
          onChange={(e) =>
            onChange({
              swingDirection: e.target.value as "inward" | "outward",
            } as Partial<WallOpening>)
          }
          className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="inward">Inward</option>
          <option value="outward">Outward</option>
        </select>
      </div>
    </div>
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

/** In-place-safe wall patch that also touches through a Vec2Mm endpoint
 *  copy so callers can just spread `{ ...startMm, x: v }`. */
function patchWall(
  arch: RoomArchitecture,
  wallId: string,
  patch: Partial<WallDefinition>,
): RoomArchitecture {
  return {
    ...arch,
    walls: arch.walls.map((w) => (w.id === wallId ? { ...w, ...patch } : w)),
  };
}

function deleteWall(arch: RoomArchitecture, wallId: string): RoomArchitecture {
  return {
    ...arch,
    walls: arch.walls.filter((w) => w.id !== wallId),
  };
}

/** Inserts a new wall AFTER `afterWallId` in the walls array (or appends
 *  at the end when nothing is selected / the id is unknown). The stub
 *  starts and ends at the previous wall's end point (so length = 0) —
 *  the user then edits its `End X` / `End Z` to place it. Topology
 *  validation flags the zero-length wall until it's moved. */
function addWallAfterSelected(
  arch: RoomArchitecture,
  afterWallId: string | null,
): RoomArchitecture {
  const idx = afterWallId
    ? arch.walls.findIndex((w) => w.id === afterWallId)
    : arch.walls.length - 1;
  const anchorEnd: Vec2Mm =
    idx >= 0 && arch.walls[idx] ? { ...arch.walls[idx]!.endMm } : { x: 0, z: 0 };
  const heightMm = arch.walls[0]?.heightMm ?? 2400;
  const thicknessMm = arch.walls[0]?.thicknessMm ?? 50;
  const newWall: WallDefinition = {
    id: generateWallId(arch),
    startMm: anchorEnd,
    endMm: { ...anchorEnd },
    heightMm,
    thicknessMm,
    openings: [],
  };
  const insertAt = idx >= 0 ? idx + 1 : arch.walls.length;
  const nextWalls = [
    ...arch.walls.slice(0, insertAt),
    newWall,
    ...arch.walls.slice(insertAt),
  ];
  return {
    ...arch,
    schemaVersion: ROOM_ARCHITECTURE_SCHEMA_VERSION,
    walls: nextWalls,
  };
}

function generateWallId(arch: RoomArchitecture): string {
  const existing = new Set(arch.walls.map((w) => w.id));
  let i = 1;
  while (existing.has(`wall:custom:${i}`)) i++;
  return `wall:custom:${i}`;
}
