import { create } from "zustand";

// Transient UI state for the Rooms workspace shell.
//
// This store deliberately holds ONLY view-preference state — never
// persistent domain data (that stays in useEditorStore) and never THREE.js
// objects (those live in the material factory cache). Nothing here is
// persisted across page loads yet; when we do persist it in a later
// milestone, this store gets a `hydrateFromLocalStorage` action.

export type ViewMode = "3d" | "2d" | "elevation" | "walkthrough";
export type InspectorTab = "cabinet" | "material" | "room";
export type RenderQuality = "performance" | "realistic";

interface WorkspaceUiState {
  activeView: ViewMode;
  inspectorTab: InspectorTab;
  /** Reserved for STEP 3. Not consumed by rendering in STEP 2. */
  renderQuality: RenderQuality;
  /** Fires when consumers should call the imperative "fit view" API on
   *  the R3F camera. Incremented on each request. */
  fitViewNonce: number;
  aiCopilotOpen: boolean;

  setActiveView: (view: ViewMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setRenderQuality: (quality: RenderQuality) => void;
  requestFitView: () => void;
  setAiCopilotOpen: (open: boolean) => void;
  toggleAiCopilot: () => void;
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

  setActiveView: (view) => {
    if (!IMPLEMENTED_VIEW_MODES.includes(view)) return;
    set({ activeView: view });
  },
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setRenderQuality: (quality) => set({ renderQuality: quality }),
  requestFitView: () => set({ fitViewNonce: get().fitViewNonce + 1 }),
  setAiCopilotOpen: (aiCopilotOpen) => set({ aiCopilotOpen }),
  toggleAiCopilot: () => set({ aiCopilotOpen: !get().aiCopilotOpen }),
}));
