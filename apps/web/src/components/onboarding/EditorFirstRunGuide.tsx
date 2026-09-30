"use client";

import { useEffect, useState } from "react";
import { trackMetaCustomEventOnce } from "@/lib/analytics";

// Floating first-run card over the editor canvas. Presentation only: it
// never creates cabinets, never touches the scene, and owns no editor
// state — it calls back into the workspace's EXISTING actions (open the
// AI Copilot / reveal the Cabinet library).
//
// Shows when: URL has ?onboarding=1 AND the room is loaded AND it has no
// cabinets AND the user hasn't dismissed it. It disappears the moment a
// cabinet exists, regardless of the dismissal preference.

const DISMISS_KEY = "cabinetflow:onboarding:editor-guide-dismissed";
const ACCENT = "#c8852a";

interface Props {
  roomReady: boolean;
  cabinetCount: number;
  onDesignWithAI: () => void;
  onBrowseLibrary: () => void;
}

export function EditorFirstRunGuide({ roomReady, cabinetCount, onDesignWithAI, onBrowseLibrary }: Props) {
  const [onboardingMode, setOnboardingMode] = useState(false);
  const [dismissed, setDismissed] = useState(true); // resolved on mount; avoids a flash
  const [libraryHint, setLibraryHint] = useState(false);

  useEffect(() => {
    try {
      setOnboardingMode(new URLSearchParams(window.location.search).get("onboarding") === "1");
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!onboardingMode || !roomReady || cabinetCount > 0 || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked — dismissal lasts for this view only.
    }
  }

  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8852a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]";

  return (
    <section
      role="region"
      aria-label="Start your first design"
      // Mobile: below the Rooms / AI toggles, full width. Desktop: top-left
      // of the canvas, clear of CanvasToolbar (bottom-left) and the
      // SceneAssetToolbar (bottom-center). Sits under the AI panel (z-30).
      className="absolute z-10 top-14 left-3 right-3 md:top-4 md:left-4 md:right-auto md:w-80 rounded-xl p-4"
      style={{
        background: "rgba(17,18,20,0.96)",
        border: `1px solid ${ACCENT}66`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase mb-1" style={{ letterSpacing: "2px", color: ACCENT }}>
            First design
          </p>
          <h2 className="text-white text-sm font-semibold">Start your first design</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss first-design guide"
          className={`text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded ${focusRing}`}
        >
          Dismiss
        </button>
      </div>

      {libraryHint ? (
        <p className="text-xs text-gray-300 mt-2 leading-relaxed">
          Pick a cabinet in the <span className="text-white font-medium">Cabinet library</span> panel
          on the left — it&apos;s added to this room and appears here on the canvas.
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          Describe the room and CabinetFlow can create a starting layout — or choose a cabinet from the
          library.
        </p>
      )}

      <div className="flex flex-col sm:flex-row md:flex-col gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            trackMetaCustomEventOnce("CabinetFlow_AIStarterUsed", "ai-starter-guide");
            onDesignWithAI();
          }}
          className={`flex-1 text-xs font-semibold rounded-lg px-3 py-2 text-white transition-opacity hover:opacity-90 ${focusRing}`}
          style={{ background: ACCENT }}
        >
          ✦ Design with AI
        </button>
        <button
          type="button"
          onClick={() => {
            setLibraryHint(true);
            onBrowseLibrary();
          }}
          className={`flex-1 text-xs font-medium rounded-lg px-3 py-2 text-gray-200 transition-colors hover:text-white ${focusRing}`}
          style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
        >
          Browse cabinet library
        </button>
      </div>
    </section>
  );
}
