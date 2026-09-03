"use client";

import { useEffect, useMemo } from "react";
import { useWorkspaceUiStore, type InspectorTab } from "../state/use-workspace-ui";
import {
  useSelectedCabinet,
  useSelectedRoom,
  useSelectedSceneAssetInstance,
  useSelection,
} from "../state/selection-adapter";
import { CabinetInspector, CabinetInspectorEmpty } from "./CabinetInspector";
import { MaterialInspector } from "./MaterialInspector";
import { RoomInspector } from "./RoomInspector";
import { SceneAssetInspector, SceneAssetInspectorEmpty } from "./SceneAssetInspector";
import { ArchitectureInspector, ArchitectureInspectorEmpty } from "./ArchitectureInspector";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import type { ValidationReport } from "@/hooks/useCabinets";

// Right-side Inspector shell. Tabs the user can click through:
//   · Cabinet   — dimensions / parameters / parts / validation
//   · Material  — room + selected cabinet material assignments
//   · Room      — read-only room info (STEP 5 will add editing)
//
// Auto-switches to the Cabinet tab when a cabinet is selected, so the
// most contextually useful pane is always in view. The user can still
// click other tabs freely.

interface Props {
  projectId: string;
  saving: boolean;
  validating: boolean;
  validationReports: Record<string, ValidationReport | undefined>;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onValidate: (id: string) => Promise<void>;
  onPreview: (id: string) => void;
}

interface TabDescriptor {
  id: InspectorTab;
  label: string;
  icon: string;
}

const BASE_TABS: readonly TabDescriptor[] = [
  { id: "cabinet", label: "Cabinet", icon: "▤" },
  { id: "material", label: "Material", icon: "◐" },
  { id: "room", label: "Room", icon: "◱" },
];

const SCENE_ASSET_TAB: TabDescriptor = { id: "sceneAsset", label: "Asset", icon: "◈" };
const ARCHITECTURE_TAB: TabDescriptor = { id: "architecture", label: "Arch", icon: "◧" };

export function InspectorPanel({
  projectId,
  saving,
  validating,
  validationReports,
  onSave,
  onDelete,
  onValidate,
  onPreview,
}: Props) {
  const inspectorTab = useWorkspaceUiStore((s) => s.inspectorTab);
  const setInspectorTab = useWorkspaceUiStore((s) => s.setInspectorTab);
  const architectureEditMode = useWorkspaceUiStore((s) => s.architectureEditMode);

  const selection = useSelection();
  const cabinet = useSelectedCabinet();
  const room = useSelectedRoom();
  const sceneAssetInstance = useSelectedSceneAssetInstance();
  const sceneAssetDefinitions = useSceneAssetsStore((s) => s.definitions);
  const sceneAssetDefinition = sceneAssetInstance
    ? sceneAssetDefinitions.find((d) => d.id === sceneAssetInstance.assetDefinitionId)
    : undefined;

  // Tabs — Architecture tab appears only when architecture edit mode is
  // on. When it's off, the tab's InspectorTab value stays type-safe but
  // is unreachable through the strip.
  const tabs = useMemo<readonly TabDescriptor[]>(() => {
    const list: TabDescriptor[] = [...BASE_TABS, SCENE_ASSET_TAB];
    if (architectureEditMode === "on") list.push(ARCHITECTURE_TAB);
    return list;
  }, [architectureEditMode]);

  // Auto-focus the Cabinet tab when a cabinet is newly selected — but
  // never override an explicit user choice made after the fact.
  useEffect(() => {
    if (selection.kind === "cabinet") setInspectorTab("cabinet");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.kind === "cabinet" ? selection.cabinetId : null]);

  // Same auto-focus behavior for Scene Asset selection.
  useEffect(() => {
    if (selection.kind === "sceneAsset") setInspectorTab("sceneAsset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.kind === "sceneAsset" ? selection.assetInstanceId : null]);

  // Auto-focus Architecture tab when a wall or opening is selected.
  useEffect(() => {
    if (selection.kind === "wall" || selection.kind === "opening") {
      setInspectorTab("architecture");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection.kind === "wall"
      ? selection.wallId
      : selection.kind === "opening"
        ? `${selection.wallId}:${selection.openingId}`
        : null,
  ]);

  const currentReport =
    selection.kind === "cabinet" ? validationReports[selection.cabinetId] : undefined;

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 w-full md:w-72"
      style={{
        background: "#0f1114",
        borderLeft: "1px solid #1E2226",
      }}
    >
      {/* Tab strip */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ borderBottom: "1px solid #1E2226" }}
      >
        {tabs.map((tab) => {
          const active = inspectorTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors relative"
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
              <span aria-hidden style={{ fontSize: 11, color: active ? "#c8852a" : undefined }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: 2, background: "#c8852a" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0">
        {inspectorTab === "cabinet" &&
          (cabinet ? (
            <CabinetInspector
              projectId={projectId}
              cabinet={cabinet}
              saving={saving}
              validating={validating}
              validationReport={currentReport}
              onSave={onSave}
              onDelete={onDelete}
              onValidate={onValidate}
              onPreview={onPreview}
            />
          ) : (
            <CabinetInspectorEmpty />
          ))}
        {inspectorTab === "material" && <MaterialInspector selectedCabinet={cabinet} />}
        {inspectorTab === "room" && <RoomInspector room={room} />}
        {inspectorTab === "sceneAsset" &&
          (sceneAssetInstance ? (
            <SceneAssetInspector
              projectId={projectId}
              instance={sceneAssetInstance}
              definition={sceneAssetDefinition}
            />
          ) : (
            <SceneAssetInspectorEmpty />
          ))}
        {inspectorTab === "architecture" && architectureEditMode === "on" && (
          room ? (
            <ArchitectureInspector projectId={projectId} room={room} />
          ) : (
            <ArchitectureInspectorEmpty />
          )
        )}
      </div>
    </aside>
  );
}
