"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor";
import { useMaterialsStore } from "@/store/materials";
import { useProject, useRoomCabinets } from "@/hooks/useProject";
import { useCabinets } from "@/hooks/useCabinets";
import { useCollab } from "@/hooks/useCollab";
import { CabinetPreviewModal } from "@/components/editor/CabinetPreviewModal";
import AICopilotPanel, { type AICabinetSpec } from "@/components/editor/AICopilotPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSummary } from "./WorkspaceSummary";
import { RoomContextPanel } from "./left/RoomContextPanel";
import { DesignCanvas } from "./canvas/DesignCanvas";
import { CanvasToolbar } from "./canvas/CanvasToolbar";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { useWorkspaceUiStore } from "./state/use-workspace-ui";

// RoomsWorkspace — the premium workspace shell.
//
// Owns:
// · project + room load lifecycle (via existing hooks)
// · material store bootstrap on project change
// · sheet visibility state for mobile drawers
// · AI Copilot open state (moved from the legacy CabinetEditor)
// · handleAddCabinets orchestration
//
// Delegates:
// · scene rendering  → DesignCanvas
// · left context     → RoomContextPanel
// · right inspector  → InspectorPanel (tabs: Cabinet | Material | Room)
// · header / footer  → WorkspaceHeader / WorkspaceSummary
// · AI panel         → existing AICopilotPanel (overlay, unchanged)
//
// Preserves the underlying editor behavior. No geometry, API, or Zustand
// domain state changed — only the presentation shell.

interface Props {
  projectId: string;
}

export function RoomsWorkspace({ projectId }: Props) {
  const { project, loading: projectLoading } = useProject(projectId);
  const { selectedRoomId, cabinets, selectedCabinetId, selectCabinet } = useEditorStore();
  const { loading: roomLoading } = useRoomCabinets(projectId, selectedRoomId);
  const { create, save, remove, validate, saving, validating, validationReports } =
    useCabinets(projectId);
  useCollab(projectId);

  const aiCopilotOpen = useWorkspaceUiStore((s) => s.aiCopilotOpen);
  const setAiCopilotOpen = useWorkspaceUiStore((s) => s.setAiCopilotOpen);
  const toggleAiCopilot = useWorkspaceUiStore((s) => s.toggleAiCopilot);

  // Bootstrap the material selection from localStorage per project.
  const loadMaterialsForProject = useMaterialsStore((s) => s.loadForProject);
  useEffect(() => {
    if (projectId) loadMaterialsForProject(projectId);
  }, [projectId, loadMaterialsForProject]);

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => project?.rooms?.find((r) => r.id === selectedRoomId),
    [project?.rooms, selectedRoomId],
  );
  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId);
  const isLoading = projectLoading || roomLoading;

  // Auto-open the properties sheet on mobile when a cabinet is selected.
  useEffect(() => {
    if (selectedCabinetId) setRightOpen(true);
  }, [selectedCabinetId]);
  useEffect(() => {
    if (!selectedCabinetId) setRightOpen(false);
  }, [selectedCabinetId]);

  // Set the AI Copilot's initial state on room entry — matches previous
  // behavior. Only fires on true→false roomLoading transition so it
  // observes the freshly-loaded cabinet count.
  const prevRoomLoadingRef = useRef(false);
  const lastAppliedRoomRef = useRef<string | null>(null);
  useEffect(() => {
    const wasLoading = prevRoomLoadingRef.current;
    prevRoomLoadingRef.current = roomLoading;
    if (!(wasLoading && !roomLoading)) return;
    if (!selectedRoomId) return;
    if (lastAppliedRoomRef.current === selectedRoomId) return;
    lastAppliedRoomRef.current = selectedRoomId;
    setAiCopilotOpen(cabinets.length === 0);
  }, [selectedRoomId, roomLoading, cabinets.length, setAiCopilotOpen]);

  const handleAddCabinets = useCallback(
    async (specs: AICabinetSpec[]) => {
      // Unchanged from the legacy CabinetEditor implementation — same
      // sketch-path vs auto-layout branching, same wall-side swap logic.
      const hasPositions = specs.some(
        (s) => s.posX !== undefined && s.posZ !== undefined,
      );

      let perimeterX = 0;
      let islandX = 0;

      for (const spec of specs) {
        let posX: number;
        let posY: number;
        let posZ: number;
        let createWidth = spec.width;
        let createDepth = spec.depth;

        if (hasPositions && spec.posX !== undefined && spec.posZ !== undefined) {
          posX = spec.posX;
          posZ = spec.posZ;
          posY = spec.posY ?? (spec.type === "wall" ? 1371 : 0);
          if (spec.wallSide === "left" || spec.wallSide === "right") {
            createWidth = spec.depth;
            createDepth = spec.width;
          }
        } else if (spec.type === "island") {
          posX = islandX;
          posY = 0;
          posZ = 1219;
          islandX += spec.width;
        } else if (spec.type === "wall") {
          posX = perimeterX;
          posY = 1371;
          posZ = 152;
          perimeterX += spec.width;
        } else {
          posX = perimeterX;
          posY = 0;
          posZ = 0;
          perimeterX += spec.width;
        }

        await create({
          type: spec.type,
          name: spec.name,
          width: createWidth,
          height: spec.height,
          depth: createDepth,
          posX,
          posY,
          posZ,
          parameters: spec.parameters,
        });
      }
    },
    [create],
  );

  if (projectLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-gray-500 text-sm">
        Loading project…
      </div>
    );
  }

  const anySheetOpen = leftOpen || rightOpen;

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      <WorkspaceHeader
        projectId={projectId}
        projectName={project?.name}
        roomName={selectedRoom?.name}
      />

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Mobile backdrop */}
        {anySheetOpen && (
          <div
            className="fixed inset-0 z-10 md:hidden"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}

        {/* Left panel */}
        <aside
          className={[
            "flex flex-col flex-shrink-0",
            "fixed inset-y-0 left-0 z-20 w-72",
            "transition-transform duration-300 ease-in-out",
            leftOpen ? "translate-x-0" : "-translate-x-full",
            "md:static md:w-60 md:translate-x-0 md:z-auto md:transition-none",
          ].join(" ")}
          style={{ background: "#111214", borderRight: "1px solid #1E2226" }}
        >
          <div
            className="px-3 py-2.5 flex items-center justify-between md:hidden"
            style={{ borderBottom: "1px solid #1E2226" }}
          >
            <p className="text-xs text-gray-400 uppercase tracking-widest">Rooms</p>
            <button
              className="text-gray-500 hover:text-white transition-colors p-1"
              onClick={() => setLeftOpen(false)}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <RoomContextPanel
              projectId={projectId}
              rooms={project?.rooms ?? []}
              cabinets={cabinets}
              onCabinetSelect={() => setLeftOpen(false)}
            />
          </div>
        </aside>

        {/* Center — canvas region */}
        <div className="flex-1 relative min-w-0">
          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-surface-100 border border-surface-300 rounded-full px-3 py-1 text-xs text-gray-400">
              Updating…
            </div>
          )}

          {/* Mobile floating controls */}
          <button
            className="absolute top-3 left-3 z-10 md:hidden flex items-center gap-1.5 text-xs text-white font-medium rounded-lg px-3 py-2 transition-colors"
            style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
            onClick={() => {
              setLeftOpen(true);
              setRightOpen(false);
            }}
          >
            <span>☰</span>
            <span>Rooms</span>
          </button>

          {/* AI Co-pilot toggle */}
          <button
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-all"
            style={{
              background: aiCopilotOpen ? "#c8852a" : "#1A1E26",
              border: aiCopilotOpen ? "1px solid #c8852a" : "1px solid #2E3240",
              color: aiCopilotOpen ? "#fff" : "#c8852a",
            }}
            onClick={() => toggleAiCopilot()}
          >
            <span>✦</span>
            <span>AI Co-pilot</span>
          </button>

          {/* Properties toggle — mobile only */}
          {selectedCabinet && (
            <button
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 md:hidden flex items-center gap-2 text-xs font-bold rounded-full px-5 py-2.5 transition-colors"
              style={{
                background: rightOpen ? "#2E2E2E" : "#c8852a",
                color: rightOpen ? "#9A9090" : "#fff",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              onClick={() => setRightOpen((v) => !v)}
            >
              {rightOpen ? "✕  Close" : `⚙  ${selectedCabinet.name}`}
            </button>
          )}

          <DesignCanvas room={selectedRoom} cabinets={cabinets} />

          <CanvasToolbar />

          {cabinets.length === 0 && !isLoading && !aiCopilotOpen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-500 text-sm">Add a cabinet to get started.</p>
            </div>
          )}

          <AICopilotPanel
            projectId={projectId}
            roomId={selectedRoomId}
            isOpen={aiCopilotOpen}
            onClose={() => setAiCopilotOpen(false)}
            onAddCabinets={handleAddCabinets}
          />
        </div>

        {/* Right — Inspector */}
        {cabinets.length > 0 && (
          <div
            className={[
              "flex-shrink-0",
              // Mobile: bottom sheet slides up (fixed height so inner scroll works)
              "fixed inset-x-0 bottom-0 z-20 h-[75vh]",
              "rounded-t-2xl overflow-hidden",
              "transition-transform duration-300 ease-in-out",
              rightOpen ? "translate-y-0" : "translate-y-full",
              // Desktop: static right column
              "md:static md:h-auto md:rounded-none md:translate-y-0 md:z-auto md:transition-none",
            ].join(" ")}
          >
            <InspectorPanel
              saving={saving}
              validating={validating}
              validationReports={validationReports}
              onSave={save}
              onDelete={async (id) => {
                await remove(id);
                selectCabinet(null);
              }}
              onValidate={validate}
              onPreview={setPreviewId}
            />
          </div>
        )}
      </div>

      <WorkspaceSummary room={selectedRoom} />

      {previewId &&
        (() => {
          const cab = cabinets.find((c) => c.id === previewId);
          return cab ? (
            <CabinetPreviewModal
              cabinet={cab}
              projectId={projectId}
              onClose={() => setPreviewId(null)}
            />
          ) : null;
        })()}
    </div>
  );
}

export default RoomsWorkspace;
