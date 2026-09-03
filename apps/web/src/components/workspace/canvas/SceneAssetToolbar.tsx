"use client";

import { useEditorStore } from "@/store/editor";
import {
  useWorkspaceUiStore,
  type SceneAssetTransformMode,
} from "../state/use-workspace-ui";

// Floating transform-mode toolbar for Scene Assets.
//
// Visible only when a Scene Asset is currently selected. Positioned
// separately from `CanvasToolbar` (bottom-left) so it never overlaps
// the cabinet-focused Fit / Snapshot controls. Two buttons: Move /
// Rotate — scale is intentionally never a mode (user-facing scale
// stays at identity per Slice 6 Scale Policy).

const MODES: readonly {
  id: SceneAssetTransformMode;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { id: "translate", label: "Move", icon: "↔", hint: "Move (drag position)" },
  { id: "rotate", label: "Rotate", icon: "↻", hint: "Rotate (drag rotation)" },
];

export function SceneAssetToolbar() {
  const selectedId = useEditorStore((s) => s.selectedSceneAssetId);
  const mode = useWorkspaceUiStore((s) => s.sceneAssetTransformMode);
  const setMode = useWorkspaceUiStore((s) => s.setSceneAssetTransformMode);

  if (!selectedId) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-lg p-1"
      style={{
        background: "rgba(15, 17, 20, 0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid #1E2226",
      }}
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.hint}
            aria-label={m.label}
            aria-pressed={active}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors"
            style={{
              background: active ? "#c8852a" : "transparent",
              color: active ? "#fff" : "#9A9288",
              fontWeight: active ? 600 : 400,
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>
              {m.icon}
            </span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
