"use client";

import { useEditorStore } from "@/store/editor";
import { RoomSelector } from "@/components/editor/RoomSelector";
import { AddCabinetButton } from "@/components/editor/AddCabinetButton";
import type { Cabinet, Room } from "@woodcraft/shared";

// Left contextual panel for the Rooms workspace.
// STEP 2: hosts the existing RoomSelector + Cabinets list + Add Cabinet.
// The Component Library tabs (Kitchen / Closet / Bathroom / Laundry)
// land in STEP 4 — the "Library" tab appears here then, disabled until
// STEP 4 ships.

interface Props {
  projectId: string;
  rooms: (Room & { _count?: { cabinets: number } })[];
  cabinets: Cabinet[];
  onCabinetSelect?: () => void; // called after selecting a cabinet (mobile drawer close)
}

export function RoomContextPanel({
  projectId,
  rooms,
  cabinets,
  onCabinetSelect,
}: Props) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);

  return (
    <div className="flex flex-col h-full">
      {/* Rooms section */}
      <section
        className="px-3 py-3"
        style={{ borderBottom: "1px solid #1E2226" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Rooms</p>
        </div>
        <RoomSelector rooms={rooms} projectId={projectId} />
      </section>

      {/* Cabinets section */}
      <section className="flex-1 min-h-0 overflow-auto p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs text-gray-400 uppercase tracking-widest">
            Cabinets{cabinets.length > 0 ? ` (${cabinets.length})` : ""}
          </p>
          <AddCabinetButton projectId={projectId} />
        </div>

        {cabinets.length === 0 ? (
          <p className="text-xs text-gray-600 px-1 mt-3">No cabinets yet.</p>
        ) : (
          <div className="space-y-0.5">
            {cabinets.map((cab) => (
              <button
                key={cab.id}
                onClick={() => {
                  selectCabinet(cab.id);
                  onCabinetSelect?.();
                }}
                className={[
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  selectedCabinetId === cab.id
                    ? "bg-brand-500/20 text-brand-400"
                    : "text-gray-400 hover:bg-surface-200 hover:text-white",
                ].join(" ")}
              >
                <span className="block truncate font-medium">{cab.name}</span>
                <span className="block text-[11px] text-gray-600 capitalize mt-0.5">
                  {cab.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Library placeholder — STEP 4 target */}
      <section
        className="px-3 py-2.5"
        style={{ borderTop: "1px solid #1E2226" }}
      >
        <button
          disabled
          className="w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between cursor-not-allowed"
          style={{ color: "#3A4050" }}
          title="Component Library — coming soon"
        >
          <span>◫ Component Library</span>
          <span className="text-[9px] uppercase tracking-wider">Soon</span>
        </button>
      </section>
    </div>
  );
}
