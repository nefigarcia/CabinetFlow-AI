"use client";

import type { Room } from "@woodcraft/shared";
import { AssignmentsPanel } from "@/components/settings/systems/AssignmentsPanel";

// STEP 2 stub — shows real room dimensions and a "properties coming
// soon" marker for the fields that will land in STEP 5 (room type
// picker via Room.metadata.roomType, walls, openings, environment).
// No fake data: every value below comes from the actual Room record.
//
// Phase 2.1 adds a Cabinet Systems Defaults section for this room —
// metadata + readiness only, resolves at Room scope on the effective-
// systems endpoint.

interface Props {
  room: Room | undefined;
  projectId?: string;
}

export function RoomInspector({ room, projectId }: Props) {
  if (!room) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <p className="text-gray-600 text-xs text-center">
          Select a room from the left panel to see its properties.
        </p>
      </div>
    );
  }

  const w = Number(room.width);
  const h = Number(room.height);
  const d = Number(room.depth);
  const floorAreaM2 = (w / 1000) * (d / 1000);

  return (
    <div className="h-full overflow-auto p-4 space-y-5">
      <header>
        <h3 className="text-white text-sm font-semibold">{room.name}</h3>
        <p className="text-gray-500 text-xs mt-0.5">Room</p>
      </header>

      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Dimensions</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {(["Width", "Height", "Depth"] as const).map((label, i) => {
            const v = [w, h, d][i]!;
            return (
              <div
                key={label}
                className="rounded-md p-2"
                style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
              >
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-white text-sm tabular-nums mt-0.5">{v.toFixed(0)}</p>
                <p className="text-[9px] text-gray-600">mm</p>
              </div>
            );
          })}
        </div>
        <p className="text-gray-500 text-[11px] mt-2 text-center">
          Floor area: <span className="text-gray-300 tabular-nums">{floorAreaM2.toFixed(2)} m²</span>
        </p>
      </section>

      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Room type</p>
        <button
          disabled
          className="w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between cursor-not-allowed"
          style={{ background: "#1A1E26", color: "#3A4050", border: "1px solid #2E3240" }}
          title="Room type picker — coming in the next milestone"
        >
          <span>Custom Room</span>
          <span className="text-[9px] uppercase tracking-wider">Soon</span>
        </button>
      </section>

      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Walls &amp; openings</p>
        <p className="text-gray-600 text-[11px] italic">
          Wall and opening editing lands in a later milestone. Rooms currently
          render as an enclosed shell with three walls, a floor, and a
          backsplash when a base cabinet is present.
        </p>
      </section>

      {/* Phase 2.1 — room-level cabinet system defaults. Metadata + readiness only. */}
      {projectId && (
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cabinet system defaults</p>
          <p className="text-[11px] text-gray-500 mb-3">
            Room-level overrides. Unassigned entries inherit from the project.
          </p>
          <AssignmentsPanel
            scope="room"
            projectId={projectId}
            roomId={room.id}
            inheritLabel="Inherit from project"
          />
        </section>
      )}
    </div>
  );
}
