"use client";

import { useMemo } from "react";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { useEditorStore } from "@/store/editor";
import type { ValidationReport } from "@/hooks/useCabinets";
import {
  detectCabinetsVsOpenings,
  getRoomArchitecture,
  type Cabinet,
  type CabinetBridgeIssue,
} from "@woodcraft/shared";

// The Cabinet inspector wraps the existing PropertiesPanel — same data
// flow, same optimistic updates, same debounced constraint propagation.
// The premium workspace shell owns positioning; PropertiesPanel keeps
// providing dimensions / parameters / parts / validation content.

interface Props {
  cabinet: Cabinet | undefined;
  saving: boolean;
  validating: boolean;
  validationReport?: ValidationReport;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onValidate: (id: string) => Promise<void>;
  onPreview: (id: string) => void;
}

export function CabinetInspector({
  cabinet,
  saving,
  validating,
  validationReport,
  onSave,
  onDelete,
  onValidate,
  onPreview,
}: Props) {
  const rooms = useEditorStore((s) => s.rooms);
  const allCabinets = useEditorStore((s) => s.cabinets);

  // Cross-source warnings surfaced here (kept OUT of the manufacturing
  // ValidationReport panel):
  //   · source="architecture" — this cabinet placed in front of a door /
  //     window / opening on any wall of its room.
  // Manufacturing validation stays in PropertiesPanel via ValidationReport.
  const architectureIssues: CabinetBridgeIssue[] = useMemo(() => {
    if (!cabinet) return [];
    const room = rooms.find((r) => r.id === cabinet.roomId);
    if (!room) return [];
    const architecture = getRoomArchitecture({
      metadata: room.metadata ?? null,
      width: Number(room.width),
      height: Number(room.height),
      depth: Number(room.depth),
    });
    // Restrict to the currently-selected cabinet so the panel only shows
    // issues relevant to what the user is looking at.
    const roomCabinets = allCabinets.filter(
      (c) => c.roomId === cabinet.roomId && c.id === cabinet.id,
    );
    return detectCabinetsVsOpenings({ cabinets: roomCabinets, architecture });
  }, [cabinet, rooms, allCabinets]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <PropertiesPanel
        cabinet={cabinet}
        saving={saving}
        validating={validating}
        validationReport={validationReport}
        onSave={onSave}
        onDelete={onDelete}
        onValidate={onValidate}
        onPreview={onPreview}
      />
      {cabinet && architectureIssues.length > 0 && (
        <div className="border-t border-surface-200 px-3 py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Architecture
            <span className="ml-1 text-gray-600 normal-case">
              ({architectureIssues.length} warning
              {architectureIssues.length === 1 ? "" : "s"})
            </span>
          </p>
          <ul className="space-y-1">
            {architectureIssues.map((issue, idx) => (
              <li
                key={idx}
                className="rounded-md px-2 py-1.5 text-[11px] flex items-start gap-1.5"
                style={{
                  background: "rgba(200, 133, 42, 0.08)",
                  border: "1px solid #6a5828",
                  color: "#c8852a",
                }}
                title={`source=${issue.source} code=${issue.code}`}
              >
                <span aria-hidden className="mt-px">⚠</span>
                <span className="min-w-0">
                  <span
                    className="mr-1 uppercase tracking-wider text-[9px]"
                    style={{ color: "#8a8080" }}
                  >
                    [{issue.source}]
                  </span>
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Empty-state helper used when nothing is selected. */
export function CabinetInspectorEmpty() {
  const cabinetCount = useEditorStore((s) => s.cabinets.length);
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-gray-600 text-xs text-center">
        {cabinetCount === 0
          ? "Add a cabinet to get started."
          : "Select a cabinet in the 3D view to edit its properties."}
      </p>
    </div>
  );
}
