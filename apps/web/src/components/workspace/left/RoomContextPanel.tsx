"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor";
import { RoomSelector } from "@/components/editor/RoomSelector";
import { AddCabinetButton } from "@/components/editor/AddCabinetButton";
import { SCENE_ASSETS_ENABLED } from "@/lib/features";
import { CatalogPanel } from "./catalog/CatalogPanel";
import { useWorkspaceUiStore } from "../state/use-workspace-ui";
import type { Cabinet, Room } from "@woodcraft/shared";

// Left contextual panel for the Rooms workspace.
//
// Layout:
//   · Rooms selector at the top
//   · "Components / Assets" region below with sub-tabs:
//       · Cabinets — always shown
//       · Catalog  — added when NEXT_PUBLIC_FEATURE_SCENE_ASSETS is on
//
// When the feature flag is off, the sub-tabs are hidden entirely and the
// panel renders exactly as it did before (Rooms + Cabinets + a small
// "Component Library — coming soon" placeholder at the bottom).

interface Props {
  projectId: string;
  rooms: (Room & { _count?: { cabinets: number } })[];
  cabinets: Cabinet[];
  onCabinetSelect?: () => void; // called after selecting a cabinet (mobile drawer close)
}

type ContentTab = "cabinets" | "catalog";

export function RoomContextPanel({
  projectId,
  rooms,
  cabinets,
  onCabinetSelect,
}: Props) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const selectedCabinetId = useEditorStore((s) => s.selectedCabinetId);
  const architectureEditMode = useWorkspaceUiStore((s) => s.architectureEditMode);
  const setArchitectureEditMode = useWorkspaceUiStore(
    (s) => s.setArchitectureEditMode,
  );

  const [contentTab, setContentTab] = useState<ContentTab>("cabinets");
  const activeTab: ContentTab = SCENE_ASSETS_ENABLED ? contentTab : "cabinets";

  return (
    <div className="flex flex-col h-full">
      {/* Rooms section */}
      <section
        className="px-3 py-3"
        style={{ borderBottom: "1px solid #1E2226" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Rooms</p>
          <button
            onClick={() =>
              setArchitectureEditMode(architectureEditMode === "on" ? "off" : "on")
            }
            className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
            title={
              architectureEditMode === "on"
                ? "Exit architecture edit mode"
                : "Edit walls, doors, and windows"
            }
            style={{
              background:
                architectureEditMode === "on" ? "#c8852a" : "#1A1E26",
              border:
                architectureEditMode === "on"
                  ? "1px solid #c8852a"
                  : "1px solid #2E3240",
              color: architectureEditMode === "on" ? "#fff" : "#9A9288",
            }}
          >
            ◧ Arch
          </button>
        </div>
        <RoomSelector rooms={rooms} projectId={projectId} />
      </section>

      {/* Content sub-tabs — only when the scene-assets feature is on. */}
      {SCENE_ASSETS_ENABLED && (
        <div
          className="flex items-center flex-shrink-0"
          style={{ borderBottom: "1px solid #1E2226" }}
        >
          <ContentTabButton
            label="Cabinets"
            active={activeTab === "cabinets"}
            onClick={() => setContentTab("cabinets")}
          />
          <ContentTabButton
            label="Catalog"
            active={activeTab === "catalog"}
            onClick={() => setContentTab("catalog")}
          />
        </div>
      )}

      {/* Content — Cabinets tab (default / flag off) */}
      {activeTab === "cabinets" && (
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
      )}

      {/* Content — Catalog tab (flag on) */}
      {activeTab === "catalog" && SCENE_ASSETS_ENABLED && (
        <section className="flex-1 min-h-0">
          <CatalogPanel projectId={projectId} />
        </section>
      )}

      {/* Legacy library placeholder — only visible when the scene-assets
          feature is OFF. When on, the actual Catalog tab replaces it. */}
      {!SCENE_ASSETS_ENABLED && (
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
      )}
    </div>
  );
}

function ContentTabButton({
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
      className="flex-1 py-2 text-xs transition-colors relative"
      style={{
        color: active ? "#fff" : "#5A6070",
        background: active ? "#111214" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#9A9288";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#5A6070";
      }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 2, background: "#c8852a" }}
        />
      )}
    </button>
  );
}
