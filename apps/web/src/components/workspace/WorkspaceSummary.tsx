"use client";

import { useEditorStore } from "@/store/editor";
import type { Room } from "@woodcraft/shared";

// Bottom information strip. STEP 2 ships ONLY the RoomSummaryCard — the
// other three (Validation, Manufacturing Readiness, Pricing) come online
// in STEP 6 when they can be backed by real state. Rendering them as
// grayed placeholders would violate the honesty rule from the audit.

interface Props {
  room: Room | undefined;
}

function SummaryCard({
  label,
  primary,
  secondary,
  accent,
}: {
  label: string;
  primary: string;
  secondary?: string;
  accent?: string;
}) {
  return (
    <div
      className="flex-1 min-w-0 px-4 py-2 flex items-center gap-3"
      style={{ borderRight: "1px solid #1E2226" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate">
          {label}
        </p>
        <p
          className="text-sm font-medium tabular-nums truncate mt-0.5"
          style={{ color: accent ?? "#e5e7eb" }}
        >
          {primary}
        </p>
        {secondary && (
          <p className="text-[10px] text-gray-600 truncate">{secondary}</p>
        )}
      </div>
    </div>
  );
}

function DisabledCard({ label, note }: { label: string; note: string }) {
  return (
    <div
      className="flex-1 min-w-0 px-4 py-2 flex items-center gap-3"
      style={{ borderRight: "1px solid #1E2226" }}
      title={note}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 truncate">
          {label}
        </p>
        <p className="text-sm font-medium mt-0.5 truncate" style={{ color: "#3A4050" }}>
          —
        </p>
        <p className="text-[10px] truncate" style={{ color: "#3A4050" }}>
          {note}
        </p>
      </div>
    </div>
  );
}

export function WorkspaceSummary({ room }: Props) {
  const cabinets = useEditorStore((s) => s.cabinets);

  if (!room) {
    return (
      <footer
        className="h-14 flex-shrink-0 flex items-center px-4"
        style={{ background: "#0f1114", borderTop: "1px solid #1E2226" }}
      >
        <p className="text-xs text-gray-600">No room selected.</p>
      </footer>
    );
  }

  const w = Number(room.width);
  const d = Number(room.depth);
  const h = Number(room.height);
  const floorAreaM2 = (w / 1000) * (d / 1000);
  const cabinetCount = cabinets.length;

  return (
    <footer
      className="h-14 flex-shrink-0 flex items-stretch"
      style={{ background: "#0f1114", borderTop: "1px solid #1E2226" }}
    >
      <SummaryCard
        label="Room"
        primary={`${w.toFixed(0)} × ${d.toFixed(0)} mm`}
        secondary={`${h.toFixed(0)} mm ceiling`}
      />
      <SummaryCard
        label="Floor area"
        primary={`${floorAreaM2.toFixed(2)} m²`}
      />
      <SummaryCard
        label="Cabinets"
        primary={String(cabinetCount)}
        secondary={cabinetCount === 1 ? "in this room" : "in this room"}
      />
      <DisabledCard
        label="Validation"
        note="Deterministic checks in a later milestone"
      />
      <DisabledCard
        label="Readiness"
        note="Manufacturing readiness in a later milestone"
      />
    </footer>
  );
}
