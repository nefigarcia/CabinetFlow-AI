"use client";

import { useMemo } from "react";
import { useMaterialsStore } from "@/store/materials";
import type {
  Cabinet,
  CabinetMaterialSelection,
  MaterialCategory,
  MaterialRenderProfile,
  MaterialSlot,
  RoomMaterialSelection,
} from "@woodcraft/shared";
import {
  DEMO_MATERIAL_REGISTRY,
  MATERIAL_SLOT_LABELS,
  SLOT_ALLOWED_CATEGORIES,
} from "@woodcraft/shared";

// Material inspector — ported from the standalone MaterialsPanel used
// during the V2.6 MVP. Same data flow, same store; positioned as an
// Inspector tab instead of a floating overlay.

interface Props {
  selectedCabinet: Cabinet | undefined;
}

const ROOM_SLOTS: readonly (keyof RoomMaterialSelection)[] = [
  "wall",
  "floor",
  "backsplash",
  "countertop",
];

const CABINET_SLOTS: readonly (keyof CabinetMaterialSelection)[] = [
  "cabinetExterior",
  "door",
  "drawerFront",
  "hardware",
];

function optionsForSlot(slot: MaterialSlot): MaterialRenderProfile[] {
  const allowed = SLOT_ALLOWED_CATEGORIES[slot];
  const allowedSet = new Set<MaterialCategory>(allowed);
  return DEMO_MATERIAL_REGISTRY.filter((m) => allowedSet.has(m.category));
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-sm border border-black/30 flex-shrink-0"
      style={{ background: hex }}
      aria-hidden
    />
  );
}

function MaterialPicker({
  label,
  slot,
  currentId,
  onChange,
}: {
  label: string;
  slot: MaterialSlot;
  currentId: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const options = useMemo(() => optionsForSlot(slot), [slot]);
  const current = currentId ? DEMO_MATERIAL_REGISTRY.find((m) => m.id === currentId) : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        {currentId && (
          <button
            onClick={() => onChange(undefined)}
            className="text-[10px] text-gray-500 hover:text-white transition-colors"
          >
            reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {current && <Swatch hex={current.baseColorHex} />}
        <select
          value={currentId ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">— use default —</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function MaterialInspector({ selectedCabinet }: Props) {
  const selection = useMaterialsStore((s) => s.selection);
  const setRoomMaterial = useMaterialsStore((s) => s.setRoomMaterial);
  const setCabinetMaterial = useMaterialsStore((s) => s.setCabinetMaterial);
  const resetAll = useMaterialsStore((s) => s.resetAll);

  const cab = selectedCabinet;
  const cabSel = cab ? selection.cabinets[cab.id] ?? {} : ({} as CabinetMaterialSelection);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Room</p>
          <div className="space-y-3">
            {ROOM_SLOTS.map((slot) => (
              <MaterialPicker
                key={slot}
                label={MATERIAL_SLOT_LABELS[slot as MaterialSlot]}
                slot={slot as MaterialSlot}
                currentId={selection.room[slot]}
                onChange={(id) => setRoomMaterial(slot, id)}
              />
            ))}
          </div>
        </section>

        <section>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
            {cab ? "Selected cabinet" : "Cabinet"}
          </p>
          {cab ? (
            <>
              <p className="text-gray-500 text-[11px] mb-3 truncate">{cab.name}</p>
              <div className="space-y-3">
                {CABINET_SLOTS.map((slot) => (
                  <MaterialPicker
                    key={slot}
                    label={MATERIAL_SLOT_LABELS[slot as MaterialSlot]}
                    slot={slot as MaterialSlot}
                    currentId={cabSel[slot]}
                    onChange={(id) => setCabinetMaterial(cab.id, slot, id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600 text-xs">
              Select a cabinet in the 3D view to override its finishes.
            </p>
          )}
        </section>
      </div>

      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderTop: "1px solid #1E2226" }}
      >
        <span className="text-[10px] text-gray-500">Saved locally · per project</span>
        <button
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm("Reset all room + cabinet material selections?")
            ) {
              resetAll();
            }
          }}
          className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
        >
          Reset all
        </button>
      </div>
    </div>
  );
}
