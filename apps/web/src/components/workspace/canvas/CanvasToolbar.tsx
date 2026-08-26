"use client";

import { useWorkspaceUiStore } from "../state/use-workspace-ui";

// Floating toolbar in the bottom-left of the canvas. STEP 2 exposes the
// operations that are honest today:
//   · Fit view          — real (imperative via workspace UI store)
//   · Snapshot          — real (canvas.toDataURL)
//
// The other classic-CAD controls (Select / Orbit / Pan / Zoom / Measure)
// are already the DEFAULT gestures OrbitControls provides — surfacing them
// as separate modes would misrepresent behavior. They are omitted rather
// than mocked. Wireframe mode lands with the STEP 3 quality toggle.

interface Props {
  containerId?: string; // element id containing the canvas (for snapshot)
}

function ToolbarButton({
  label,
  onClick,
  icon,
  disabled = false,
  tooltip,
}: {
  label: string;
  onClick?: () => void;
  icon: string;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip ?? label}
      aria-label={label}
      className="w-9 h-9 flex items-center justify-center rounded-md text-sm transition-colors"
      style={{
        background: disabled ? "transparent" : "#1A1E26",
        color: disabled ? "#3a3a3a" : "#d0d0d0",
        border: disabled ? "1px solid transparent" : "1px solid #2E3240",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = "#242a35";
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = "#1A1E26";
      }}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

function takeSnapshot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) return;
  try {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot-${Date.now()}.png`;
    a.click();
  } catch {
    // Silent — some GL configurations disallow readback.
  }
}

export function CanvasToolbar(_props: Props) {
  const requestFitView = useWorkspaceUiStore((s) => s.requestFitView);

  return (
    <div
      className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-lg p-1"
      style={{
        background: "rgba(15, 17, 20, 0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid #1E2226",
      }}
    >
      <ToolbarButton
        label="Fit view"
        icon="⛶"
        onClick={requestFitView}
        tooltip="Fit view (reset camera)"
      />
      <ToolbarButton
        label="Snapshot"
        icon="◈"
        onClick={takeSnapshot}
        tooltip="Snapshot (download PNG)"
      />
      <div className="h-px my-0.5" style={{ background: "#2E3240" }} />
      <ToolbarButton
        label="Measure"
        icon="⇔"
        disabled
        tooltip="Measure — coming soon"
      />
      <ToolbarButton
        label="Wireframe"
        icon="◇"
        disabled
        tooltip="Wireframe — coming soon"
      />
    </div>
  );
}
