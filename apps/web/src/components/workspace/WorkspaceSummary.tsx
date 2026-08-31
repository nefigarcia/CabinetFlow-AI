"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import {
  getRoomArchitecture,
  summarizeDesignReadiness,
  type Room,
} from "@woodcraft/shared";

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
  const sceneInstances = useSceneAssetsStore((s) => s.instances);
  const sceneDefs = useSceneAssetsStore((s) => s.definitions);

  const readiness = useMemo(() => {
    if (!room) return null;
    const architecture = getRoomArchitecture({
      metadata: room.metadata ?? null,
      width: Number(room.width),
      height: Number(room.height),
      depth: Number(room.depth),
    });
    const scene = sceneInstances
      .filter((i) => i.roomId === room.id)
      .map((instance) => {
        const definition = sceneDefs.find((d) => d.id === instance.assetDefinitionId);
        return definition ? { instance, definition } : null;
      })
      .filter((v): v is { instance: (typeof sceneInstances)[number]; definition: (typeof sceneDefs)[number] } => v !== null);
    return summarizeDesignReadiness({
      cabinets: cabinets.filter((c) => c.roomId === room.id),
      architecture,
      sceneAssets: scene,
    });
  }, [room, cabinets, sceneInstances, sceneDefs]);

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
  const cabinetCount = cabinets.filter((c) => c.roomId === room.id).length;

  const layoutOk =
    readiness &&
    readiness.layout.overlaps === 0 &&
    readiness.layout.unassignedGaps === 0 &&
    readiness.layout.openingConflicts === 0 &&
    !readiness.layout.exceedsWall;
  const mfgOk =
    readiness &&
    readiness.manufacturing.cabinetsMissingParts.length === 0 &&
    readiness.manufacturing.cabinetsMissingMaterial.length === 0;

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
        secondary={`${readiness?.layout.runs ?? 0} wall run${(readiness?.layout.runs ?? 0) === 1 ? "" : "s"}`}
      />
      {readiness ? (
        <SummaryCard
          label="Layout"
          primary={layoutOk ? "✓ clean" : layoutSummary(readiness)}
          secondary={`Remaining ${readiness.layout.totalRemainingMm.toFixed(0)} mm`}
          accent={layoutOk ? "#7fbf7f" : "#c8852a"}
        />
      ) : (
        <DisabledCard label="Layout" note="Layout summary loads with the room" />
      )}
      {readiness ? (
        <SummaryCard
          label="Manufacturing"
          primary={mfgOk ? "✓ ready" : mfgSummary(readiness)}
          secondary={
            mfgOk
              ? "Parts + materials resolved"
              : `${readiness.manufacturing.cabinetsMissingParts.length} no parts · ${readiness.manufacturing.cabinetsMissingMaterial.length} no material`
          }
          accent={mfgOk ? "#7fbf7f" : "#c8852a"}
        />
      ) : (
        <DisabledCard label="Manufacturing" note="Manufacturing summary loads with the room" />
      )}
    </footer>
  );
}

function layoutSummary(r: NonNullable<ReturnType<typeof summarizeDesignReadiness>>): string {
  const parts: string[] = [];
  if (r.layout.overlaps > 0) parts.push(`${r.layout.overlaps} overlap${r.layout.overlaps === 1 ? "" : "s"}`);
  if (r.layout.unassignedGaps > 0) parts.push(`${r.layout.unassignedGaps} gap${r.layout.unassignedGaps === 1 ? "" : "s"}`);
  if (r.layout.openingConflicts > 0) parts.push(`${r.layout.openingConflicts} opening conflict${r.layout.openingConflicts === 1 ? "" : "s"}`);
  if (r.layout.exceedsWall) parts.push("wall overflow");
  return parts.length === 0 ? "⚠ issues" : `⚠ ${parts.join(" · ")}`;
}

function mfgSummary(r: NonNullable<ReturnType<typeof summarizeDesignReadiness>>): string {
  const missingParts = r.manufacturing.cabinetsMissingParts.length;
  const missingMat = r.manufacturing.cabinetsMissingMaterial.length;
  if (missingParts === 0 && missingMat === 0) return "✓ ready";
  return `⚠ ${missingParts + missingMat} pending`;
}
