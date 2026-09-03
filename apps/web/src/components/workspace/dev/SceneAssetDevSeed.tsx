"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useSceneAssets } from "@/hooks/useSceneAssets";

// DEVELOPMENT-ONLY seed control.
//
// Renders nothing in production (`NODE_ENV === "production"`) so it can
// never appear in a shipped build.
//
// The seed exercises the REAL persistence path (POST to the scene-
// assets route → server-generated cuid → store update → select). Lets
// a dev verify auth, tenancy scoping, and the migrated table in one
// click. Once the catalog UI is enough for smoke-testing, this
// component can be deleted.

const CATALOG_SOFA_ID = "sofa-3seat-generic";

interface Props {
  projectId: string;
}

export function SceneAssetDevSeed({ projectId }: Props) {
  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  const selectSceneAsset = useEditorStore((s) => s.selectSceneAsset);
  const instanceCount = useSceneAssetsStore((s) => s.instances.length);
  const { create, remove } = useSceneAssets(projectId);
  const [busy, setBusy] = useState(false);

  // Production tree-shakes this away: `process.env.NODE_ENV` is
  // compile-time-inlined by Next.js.
  if (process.env.NODE_ENV === "production") return null;

  const canSeed = Boolean(projectId && selectedRoomId);

  const seed = async () => {
    if (!canSeed || busy) return;
    setBusy(true);
    try {
      const instance = await create({
        assetDefinitionId: CATALOG_SOFA_ID,
        positionMm: { x: 1200, y: 0, z: 1200 },
      });
      if (instance) selectSceneAsset(instance.id);
    } finally {
      setBusy(false);
    }
  };

  // Dev "clear" now issues real DELETEs — the epic requires the seed to
  // exercise the real persistence path, and leaving orphaned rows in the
  // DB after clicking "clear" would defeat the smoke-test intent.
  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const currentIds = useSceneAssetsStore
        .getState()
        .instances.map((i) => i.id);
      for (const id of currentIds) {
        // Sequential to keep server load trivially bounded during dev use.
        // eslint-disable-next-line no-await-in-loop
        await remove(id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed left-2 bottom-2 z-50 flex items-center gap-1 rounded px-2 py-1 text-xs font-mono"
      style={{
        background: "rgba(200, 133, 42, 0.10)",
        color: "#c8852a",
        border: "1px dashed #c8852a",
      }}
      title="Development-only. POSTs a placeholder sofa to the current room. Never shipped in production."
    >
      <span>dev:</span>
      {canSeed ? (
        <button
          onClick={seed}
          disabled={busy}
          className="rounded px-1.5 py-0.5 hover:bg-white/5 disabled:opacity-50"
        >
          {busy ? "…" : "seed sofa"}
        </button>
      ) : (
        <span className="opacity-60" title="Open a project + room first">
          select a room
        </span>
      )}
      {instanceCount > 0 && (
        <>
          <span className="opacity-60">({instanceCount})</span>
          <button
            onClick={clear}
            disabled={busy}
            className="rounded px-1.5 py-0.5 hover:bg-white/5 disabled:opacity-50"
          >
            clear
          </button>
        </>
      )}
    </div>
  );
}
