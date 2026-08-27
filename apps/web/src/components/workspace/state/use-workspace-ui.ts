import { create } from "zustand";

// Transient UI state for the Rooms workspace shell.
//
// This store deliberately holds ONLY view-preference state — never
// persistent domain data (that stays in useEditorStore) and never THREE.js
// objects (those live in the material factory cache). Nothing here is
// persisted across page loads yet; when we do persist it in a later
// milestone, this store gets a `hydrateFromLocalStorage` action.

export type ViewMode = "3d" | "2d" | "elevation" | "walkthrough";
// `sceneAsset` is only reachable when NEXT_PUBLIC_FEATURE_SCENE_ASSETS is on
// (InspectorPanel filters the tab list); it is declared here so the store
// and inspector remain type-safe whether the flag is on or off.
// `architecture` is reachable when the architecture edit mode is on.
export type InspectorTab =
  | "cabinet"
  | "material"
  | "room"
  | "sceneAsset"
  | "architecture";
export type RenderQuality = "performance" | "realistic";
/** Scene Asset TransformControls mode. Scale is intentionally omitted —
 *  user-facing scale stays at identity in MVP (see Slice 6 Scale Policy). */
export type SceneAssetTransformMode = "translate" | "rotate";
/** Which architectural view is active for the Rooms workspace: pure
 *  cabinet/asset editing, or an architecture-editing mode with wall/
 *  opening selection + overlays. */
export type ArchitectureEditMode = "off" | "on";

interface WorkspaceUiState {
  activeView: ViewMode;
  inspectorTab: InspectorTab;
  /** Reserved for STEP 3. Not consumed by rendering in STEP 2. */
  renderQuality: RenderQuality;
  /** Fires when consumers should call the imperative "fit view" API on
   *  the R3F camera. Incremented on each request. */
  fitViewNonce: number;
  aiCopilotOpen: boolean;
  /** TransformControls mode for the currently-selected Scene Asset. */
  sceneAssetTransformMode: SceneAssetTransformMode;
  /** Editor architecture-mode toggle. When on: opening outlines render,
   *  the Architecture inspector tab becomes reachable, and wall/opening
   *  selection is enabled. When off: legacy cabinet-focused view. */
  architectureEditMode: ArchitectureEditMode;
  /** Independent of edit-mode: force overlay rendering regardless. Kept
   *  separate so a future "always show" view preference is distinct from
   *  the editing entry point. */
  showArchitectureOverlays: boolean;

  setActiveView: (view: ViewMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setRenderQuality: (quality: RenderQuality) => void;
  requestFitView: () => void;
  setAiCopilotOpen: (open: boolean) => void;
  toggleAiCopilot: () => void;
  setSceneAssetTransformMode: (mode: SceneAssetTransformMode) => void;
  setArchitectureEditMode: (mode: ArchitectureEditMode) => void;
  setShowArchitectureOverlays: (visible: boolean) => void;
}

/** Only "3d" is functional today. The other view modes render as disabled
 *  in the header per the STEP 1 honesty rule. */
export const IMPLEMENTED_VIEW_MODES: readonly ViewMode[] = ["3d"];

export const useWorkspaceUiStore = create<WorkspaceUiState>((set, get) => ({
  activeView: "3d",
  inspectorTab: "cabinet",
  renderQuality: "realistic",
  fitViewNonce: 0,
  aiCopilotOpen: false,
  sceneAssetTransformMode: "translate",
  architectureEditMode: "off",
  showArchitectureOverlays: false,

  setActiveView: (view) => {
    if (!IMPLEMENTED_VIEW_MODES.includes(view)) return;
    set({ activeView: view });
  },
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setRenderQuality: (quality) => set({ renderQuality: quality }),
  requestFitView: () => set({ fitViewNonce: get().fitViewNonce + 1 }),
  setAiCopilotOpen: (aiCopilotOpen) => set({ aiCopilotOpen }),
  toggleAiCopilot: () => set({ aiCopilotOpen: !get().aiCopilotOpen }),
  setSceneAssetTransformMode: (sceneAssetTransformMode) => set({ sceneAssetTransformMode }),
  setArchitectureEditMode: (architectureEditMode) =>
    // Turning architecture mode on implicitly enables overlays; turning
    // it off doesn't force overlays off (user preference wins).
    set((s) => ({
      architectureEditMode,
      showArchitectureOverlays:
        architectureEditMode === "on" ? true : s.showArchitectureOverlays,
    })),
  setShowArchitectureOverlays: (showArchitectureOverlays) => set({ showArchitectureOverlays }),
}));
