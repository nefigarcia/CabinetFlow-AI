"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_DUPLICATE_OFFSET_MM_X,
  duplicateSceneAssetInstance,
  SCENE_ASSET_CATEGORY_LABELS,
  type SceneAssetDefinition,
  type SceneAssetInstance,
  type Vec3,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useSceneAssets } from "@/hooks/useSceneAssets";
import { useDebounce } from "@/lib/useDebounce";
import { SceneAssetSpatialValidation } from "./SceneAssetSpatialValidation";

// Inspector body for a selected Scene Asset instance — Slice 6 persistence.
//
// Editing flow:
//   · Position / rotation edits: OPTIMISTIC local update (via the store's
//     `updateInstance`) + DEBOUNCED PATCH to the server. Matches the
//     cabinet `PropertiesPanel` debounce pattern (800 ms after last keystroke).
//   · Visibility toggle: immediate PATCH (discrete, low-frequency).
//   · Duplicate: composes a create payload via the shared pure helper,
//     POSTs, adds server-returned instance to the store, selects it.
//   · Delete: DELETE-first — the store row is only removed after the
//     server confirms deletion. `useSceneAssets.remove` also clears
//     selection.
//
// If a save/patch fails, the store keeps the optimistic local value but a
// visible error banner surfaces at the top of the panel so the user knows
// their edit isn't persisted yet. No silent "saved" pretense.

interface Props {
  projectId: string;
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition | undefined;
}

const SAVE_DEBOUNCE_MS = 800;

/** Rejects NaN / Infinity. Everything finite (including negatives) is fine. */
function sanitizeNumber(raw: number, fallback: number): number {
  return Number.isFinite(raw) ? raw : fallback;
}

export function SceneAssetInspector({ projectId, instance, definition }: Props) {
  const updateInstance = useSceneAssetsStore((s) => s.updateInstance);
  const { create, save, remove, saving } = useSceneAssets(projectId);

  const [error, setError] = useState<string | null>(null);

  // One debounced saver per instance-id, so switching to a different
  // instance mid-typing doesn't accidentally send the previous edit against
  // the new id. Rebuilds on id change; the closure captures `save`.
  const debouncedSave = useDebounce<[string, Parameters<typeof save>[1]]>(
    useCallback(
      (id, patch) => {
        void save(id, patch).then((res) => {
          if (!res) setError("Couldn't save latest edit — retry your change.");
          else setError(null);
        });
      },
      [save],
    ),
    SAVE_DEBOUNCE_MS,
  );

  const setPositionField = useMemo(
    () => (field: keyof Vec3) => (raw: number) => {
      const value = sanitizeNumber(raw, instance.positionMm[field]);
      const nextPositionMm = { ...instance.positionMm, [field]: value };
      updateInstance(instance.id, { positionMm: nextPositionMm });
      debouncedSave(instance.id, { positionMm: nextPositionMm });
    },
    [instance.id, instance.positionMm, updateInstance, debouncedSave],
  );

  const setRotationField = useMemo(
    () => (field: keyof Vec3) => (raw: number) => {
      const value = sanitizeNumber(raw, instance.rotationDeg[field]);
      const nextRotationDeg = { ...instance.rotationDeg, [field]: value };
      updateInstance(instance.id, { rotationDeg: nextRotationDeg });
      debouncedSave(instance.id, { rotationDeg: nextRotationDeg });
    },
    [instance.id, instance.rotationDeg, updateInstance, debouncedSave],
  );

  const toggleVisible = async () => {
    const nextVisible = !instance.visible;
    // Optimistic — the checkbox flips immediately. Non-debounced because
    // toggling is discrete and low-frequency.
    updateInstance(instance.id, { visible: nextVisible });
    const res = await save(instance.id, { visible: nextVisible });
    if (!res) {
      setError("Couldn't save visibility — retry your change.");
    } else {
      setError(null);
    }
  };

  const selectSceneAsset = useEditorStore((s) => s.selectSceneAsset);

  const handleDuplicate = async () => {
    const payload = duplicateSceneAssetInstance(instance);
    const created = await create(payload);
    if (created) {
      selectSceneAsset(created.id);
      setError(null);
    } else {
      setError("Couldn't duplicate — retry.");
    }
  };

  const handleDelete = async () => {
    const ok = await remove(instance.id);
    if (!ok) setError("Couldn't delete — retry.");
  };

  const categoryLabel = definition
    ? SCENE_ASSET_CATEGORY_LABELS[definition.category]
    : "Unknown";
  const name = definition?.name ?? "(definition missing)";
  const dims = definition?.dimensionsMm;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-surface-200 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-white text-sm font-semibold truncate">{name}</h3>
          <p className="text-gray-500 text-xs">{categoryLabel}</p>
        </div>
        {saving && <span className="text-gray-500 text-xs flex-shrink-0">saving…</span>}
      </div>

      {error && (
        <div
          className="mx-3 mt-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(220, 60, 60, 0.10)",
            border: "1px solid #6a2828",
            color: "#e07070",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-5">
        {/* Dimensions — readonly */}
        {dims && (
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Dimensions
              <span className="ml-1 text-gray-600 normal-case">(from catalog)</span>
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <ReadonlyStat label="W" value={`${dims.widthMm} mm`} />
              <ReadonlyStat label="H" value={`${dims.heightMm} mm`} />
              <ReadonlyStat label="D" value={`${dims.depthMm} mm`} />
            </div>
          </section>
        )}

        {/* Position — editable. Y=0 rests on floor (bottom-center anchor). */}
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Position
            <span className="ml-1 text-gray-600 normal-case">(mm — Y = 0 is floor)</span>
          </p>
          <div className="space-y-2">
            <NumberInput label="X" unit="mm" value={instance.positionMm.x} onChange={setPositionField("x")} />
            <NumberInput label="Y" unit="mm" value={instance.positionMm.y} onChange={setPositionField("y")} />
            <NumberInput label="Z" unit="mm" value={instance.positionMm.z} onChange={setPositionField("z")} />
          </div>
        </section>

        {/* Rotation — editable, degrees. */}
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Rotation
            <span className="ml-1 text-gray-600 normal-case">(degrees)</span>
          </p>
          <div className="space-y-2">
            <NumberInput label="X" unit="°" value={instance.rotationDeg.x} onChange={setRotationField("x")} />
            <NumberInput label="Y" unit="°" value={instance.rotationDeg.y} onChange={setRotationField("y")} />
            <NumberInput label="Z" unit="°" value={instance.rotationDeg.z} onChange={setRotationField("z")} />
          </div>
        </section>

        {/* Visibility */}
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Visibility</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={instance.visible}
              onChange={toggleVisible}
              className="accent-brand-500"
            />
            <span className="text-white text-sm">
              {instance.visible ? "Visible" : "Hidden"}
            </span>
          </label>
        </section>

        {/* Spatial validation — scene-source warnings only. Never mixed
            with cabinet manufacturing validation. */}
        {definition && (
          <SceneAssetSpatialValidation instance={instance} definition={definition} />
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-surface-200 flex flex-col gap-2">
        <button
          onClick={handleDuplicate}
          disabled={saving}
          className="w-full text-sm bg-surface-100 hover:bg-surface-200 disabled:opacity-50 text-gray-200 py-1.5 rounded-md transition-colors"
          title={`Creates a copy offset +${DEFAULT_DUPLICATE_OFFSET_MM_X} mm on X`}
        >
          Duplicate
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="w-full text-sm text-red-500 hover:text-red-400 hover:bg-surface-100 disabled:opacity-50 py-1.5 rounded-md transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** Empty-state helper. Shown when the Asset tab is open but nothing is selected. */
export function SceneAssetInspectorEmpty() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-gray-600 text-xs text-center">
        Select a scene asset in the 3D view to edit its properties.
      </p>
    </div>
  );
}

function ReadonlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white tabular-nums">{value}</p>
    </div>
  );
}

function NumberInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">
        {label} ({unit})
      </label>
      <input
        type="number"
        value={value}
        step={1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
