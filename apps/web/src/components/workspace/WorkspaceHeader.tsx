"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useEditorStore } from "@/store/editor";
import { CncExportModal } from "@/components/editor/CncExportModal";
import { useWorkspaceUiStore, type ViewMode, IMPLEMENTED_VIEW_MODES } from "./state/use-workspace-ui";

// Premium workspace header:
// · Breadcrumbs → Projects › Project › Rooms › Room
// · View mode segmented control (2D / 3D / Elevation / Walkthrough)
//   — non-implemented modes render as disabled with "coming soon" tooltip
// · Save state indicator (unsaved changes / saving)
// · Action buttons: Save Revision · Cut List · Export CNC · Quote →
//
// Actions are unchanged from the previous EditorHeader — the goal for
// STEP 2 is layout + honesty, not feature churn.

interface Props {
  projectId: string;
  projectName?: string;
  roomName?: string;
}

const VIEW_MODES: readonly { id: ViewMode; label: string }[] = [
  { id: "2d", label: "2D Plan" },
  { id: "3d", label: "3D" },
  { id: "elevation", label: "Elevation" },
  { id: "walkthrough", label: "Walkthrough" },
];

function ViewModeToggle() {
  const activeView = useWorkspaceUiStore((s) => s.activeView);
  const setActiveView = useWorkspaceUiStore((s) => s.setActiveView);
  return (
    <div
      className="flex items-center rounded-md overflow-hidden"
      style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
      role="tablist"
      aria-label="View mode"
    >
      {VIEW_MODES.map((mode) => {
        const active = activeView === mode.id;
        const implemented = IMPLEMENTED_VIEW_MODES.includes(mode.id);
        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={active}
            disabled={!implemented}
            onClick={() => implemented && setActiveView(mode.id)}
            title={implemented ? mode.label : `${mode.label} — coming soon`}
            className="text-[11px] px-2.5 py-1 transition-colors"
            style={{
              background: active ? "#c8852a" : "transparent",
              color: active ? "#fff" : implemented ? "#d0d0d0" : "#3A4050",
              cursor: implemented ? "pointer" : "not-allowed",
              fontWeight: active ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (implemented && !active)
                (e.currentTarget as HTMLElement).style.background = "#242a35";
            }}
            onMouseLeave={(e) => {
              if (implemented && !active)
                (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function SaveStateIndicator({ savingRevision }: { savingRevision: boolean }) {
  const isDirty = useEditorStore((s) => s.isDirty);
  if (savingRevision) {
    return <span className="text-xs text-brand-400">saving revision…</span>;
  }
  if (isDirty) {
    return (
      <span className="text-xs text-gray-500 italic flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "#E8C547" }}
          aria-hidden
        />
        unsaved changes
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-600 flex items-center gap-1.5">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "#4a4a4a" }}
        aria-hidden
      />
      saved
    </span>
  );
}

export function WorkspaceHeader({ projectId, projectName, roomName }: Props) {
  const [showCncModal, setShowCncModal] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [revisionMsg, setRevisionMsg] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionSaved, setRevisionSaved] = useState(false);

  async function saveRevision() {
    setSavingRevision(true);
    try {
      await apiClient.post(`/projects/${projectId}/revisions`, {
        message: revisionMsg.trim() || undefined,
      });
      setRevisionSaved(true);
      setShowRevisionInput(false);
      setRevisionMsg("");
      setTimeout(() => setRevisionSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRevision(false);
    }
  }

  return (
    <>
      <header
        className="h-12 flex-shrink-0 flex items-center px-4 gap-3"
        style={{ background: "#111214", borderBottom: "1px solid #1E2226" }}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs min-w-0" aria-label="Breadcrumb">
          <Link
            href="/projects"
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            Projects
          </Link>
          <span className="text-gray-700 flex-shrink-0">›</span>
          <Link
            href={`/projects/${projectId}`}
            className="text-gray-500 hover:text-gray-300 transition-colors truncate max-w-[140px]"
          >
            {projectName ?? "Project"}
          </Link>
          <span className="text-gray-700 flex-shrink-0">›</span>
          <span className="text-gray-500 flex-shrink-0">Rooms</span>
          {roomName && (
            <>
              <span className="text-gray-700 flex-shrink-0">›</span>
              <span className="text-white font-medium truncate max-w-[160px]">
                {roomName}
              </span>
            </>
          )}
        </nav>

        {/* View mode segmented control */}
        <div className="hidden md:block ml-4">
          <ViewModeToggle />
        </div>

        {/* Save state */}
        <div className="ml-3">
          <SaveStateIndicator savingRevision={savingRevision} />
        </div>

        <div className="flex-1" />

        {/* Save Revision */}
        {showRevisionInput ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={revisionMsg}
              onChange={(e) => setRevisionMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveRevision();
                if (e.key === "Escape") setShowRevisionInput(false);
              }}
              placeholder="Revision note (optional)"
              className="text-xs bg-surface-100 border border-surface-300 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-52"
            />
            <button
              onClick={() => void saveRevision()}
              disabled={savingRevision}
              className="text-xs bg-surface-200 hover:bg-surface-300 text-gray-200 px-2.5 py-1 rounded transition-colors"
            >
              {savingRevision ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowRevisionInput(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRevisionInput(true)}
            className={`text-xs transition-colors px-3 py-1.5 rounded-md ${
              revisionSaved
                ? "text-green-400"
                : "text-gray-400 hover:text-white hover:bg-surface-100"
            }`}
          >
            {revisionSaved ? "✓ Saved" : "Save Revision"}
          </button>
        )}

        <Link
          href={`/projects/${projectId}/cutlist`}
          className="text-xs text-gray-400 hover:text-white hover:bg-surface-100 px-3 py-1.5 rounded-md transition-colors"
        >
          Cut List
        </Link>

        <button
          onClick={() => setShowCncModal(true)}
          className="text-xs bg-surface-200 hover:bg-surface-300 text-gray-200 px-3 py-1.5 rounded-md transition-colors"
        >
          Export CNC
        </button>

        <Link
          href={`/projects/${projectId}/quotes/new`}
          className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-md transition-colors"
        >
          Quote →
        </Link>
      </header>

      {showCncModal && (
        <CncExportModal
          projectId={projectId}
          onClose={() => setShowCncModal(false)}
        />
      )}
    </>
  );
}
