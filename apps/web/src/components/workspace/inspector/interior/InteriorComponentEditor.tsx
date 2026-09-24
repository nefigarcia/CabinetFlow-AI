"use client";

// Add/Edit modal for a single interior component.
//
// One modal covers BOTH create + edit (identity mode by `initial`
// prop). For create mode, a category → type picker leads to the
// type-specific field form. For edit mode, the type is fixed and
// only its fields render.
//
// The modal builds a COMPLETE candidate component via
// `newInteriorComponentId()` (create) or preserving the initial id
// (edit) and emits it via `onSubmit(component)`. The parent section
// atomically PATCHes the whole array — this modal never mutates the
// cabinet directly.

import { useMemo, useState } from "react";
import {
  cabinetInteriorComponentSchema,
  newInteriorComponentId,
  type CabinetInteriorComponent,
  type InteriorCabinetContext,
  type InteriorComponentTarget,
  type InteriorComponentType,
  type InteriorTargetKind,
  type StandaloneInteriorComponent,
} from "@woodcraft/shared";
import {
  INTERIOR_TARGET_KIND_LABELS,
  INTERIOR_TYPE_CATEGORIES,
  INTERIOR_TYPE_LABELS,
  humanTargetLabel,
} from "./type-labels";

interface Props {
  /** null → create mode. Only standalone components are editable here —
   *  linked (definitionId) components are never offered for edit in 3.1a. */
  initial: StandaloneInteriorComponent | null;
  cabinet: InteriorCabinetContext;
  onClose: () => void;
  onSubmit: (component: CabinetInteriorComponent) => Promise<void> | void;
}

export function InteriorComponentEditor({
  initial,
  cabinet,
  onClose,
  onSubmit,
}: Props) {
  const isEdit = !!initial;
  const [chosenType, setChosenType] = useState<InteriorComponentType | null>(
    initial?.type ?? null,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
        style={{ background: "#0f1218", border: "1px solid #22262E" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base">
            {isEdit ? `Edit — ${labelOf(initial!)}` : "Add Interior Component"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>

        {chosenType === null ? (
          <TypePicker onPick={setChosenType} />
        ) : (
          <TypeForm
            type={chosenType}
            initial={initial}
            cabinet={cabinet}
            onCancel={onClose}
            onSubmit={onSubmit}
            allowSwitchType={!isEdit}
            onSwitchType={() => setChosenType(null)}
          />
        )}
      </div>
    </div>
  );
}

function labelOf(c: CabinetInteriorComponent): string {
  return c.label ?? INTERIOR_TYPE_LABELS[c.type];
}

// ─── Category → type picker (create mode only) ─────────────────────

function TypePicker({ onPick }: { onPick: (t: InteriorComponentType) => void }) {
  return (
    <div className="space-y-4">
      {INTERIOR_TYPE_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {cat.types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onPick(t)}
                className="text-xs px-3 py-1.5 rounded-md text-gray-200 hover:text-white transition-colors"
                style={{ background: "#151920", border: "1px solid #22262E" }}
              >
                {INTERIOR_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Type-specific form ────────────────────────────────────────────

function TypeForm({
  type,
  initial,
  cabinet,
  onCancel,
  onSubmit,
  allowSwitchType,
  onSwitchType,
}: {
  type: InteriorComponentType;
  initial: StandaloneInteriorComponent | null;
  cabinet: InteriorCabinetContext;
  onCancel: () => void;
  onSubmit: (c: CabinetInteriorComponent) => Promise<void> | void;
  allowSwitchType: boolean;
  onSwitchType: () => void;
}) {
  // Shared base state
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true);
  const [target, setTarget] = useState<InteriorComponentTarget | undefined>(
    initial?.target,
  );

  // Type-specific state (only fields relevant to `type` are used)
  const [quantity, setQuantity] = useState<string>(
    initial && "quantity" in initial && initial.quantity != null
      ? String(initial.quantity)
      : "",
  );
  const [bins, setBins] = useState<string>(
    initial && initial.type === "trash_pullout" ? String(initial.bins) : "",
  );
  const [nominalBinSizeQt, setNominalBinSizeQt] = useState<string>(
    initial && initial.type === "trash_pullout" && initial.nominalBinSizeQt != null
      ? String(initial.nominalBinSizeQt)
      : "",
  );
  const [configuration, setConfiguration] = useState<string>(
    initial && initial.type === "trash_pullout" && initial.configuration
      ? initial.configuration
      : "",
  );
  const [openSides, setOpenSides] = useState<boolean>(
    initial && initial.type === "rollout" ? initial.openSides ?? false : false,
  );
  const [spiceLocation, setSpiceLocation] = useState<string>(
    initial && initial.type === "spice_rack" && initial.location ? initial.location : "",
  );
  const [hiddenLocation, setHiddenLocation] = useState<string>(
    initial && initial.type === "hidden_drawer" && initial.location ? initial.location : "",
  );
  const [dividerOrientation, setDividerOrientation] = useState<string>(
    initial && initial.type === "drawer_divider" && initial.orientation
      ? initial.orientation
      : "",
  );
  const [dividerCount, setDividerCount] = useState<string>(
    initial && initial.type === "drawer_divider" && initial.count != null
      ? String(initial.count)
      : "",
  );
  const [removable, setRemovable] = useState<boolean>(() => {
    if (initial && (initial.type === "drawer_divider" || initial.type === "utensil_divider")) {
      return initial.removable ?? false;
    }
    return false;
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requiresDrawerTarget = useMemo(
    () => type === "knife_organizer" || type === "utensil_divider" || type === "drawer_divider",
    [type],
  );

  function build(): CabinetInteriorComponent | { _error: string } {
    const id = initial?.id ?? newInteriorComponentId();
    const base = {
      id,
      enabled,
      label: label.trim() || undefined,
      notes: notes.trim() || undefined,
      target,
      verificationStatus: initial?.verificationStatus,
      sourceRef: initial?.sourceRef,
      metadata: initial?.metadata,
    };

    try {
      let component: CabinetInteriorComponent;
      switch (type) {
        case "rollout": {
          const qtyN = parseOptionalPositiveInt(quantity, "Quantity");
          component = {
            ...base,
            type,
            ...(qtyN !== undefined ? { quantity: qtyN } : {}),
            ...(openSides ? { openSides } : {}),
          };
          break;
        }
        case "trash_pullout": {
          const binsN = parsePositiveInt(bins, "Bins");
          const sizeN = parseOptionalPositiveNumber(nominalBinSizeQt, "Bin size (qt)");
          component = {
            ...base,
            type,
            bins: binsN,
            ...(sizeN !== undefined ? { nominalBinSizeQt: sizeN } : {}),
            ...(configuration ? { configuration: configuration as "single" | "double" | "triple" } : {}),
          };
          break;
        }
        case "tray_divider": {
          const qtyN = parseOptionalPositiveInt(quantity, "Quantity");
          component = {
            ...base,
            type,
            ...(qtyN !== undefined ? { quantity: qtyN } : {}),
          };
          break;
        }
        case "spice_rack":
          component = {
            ...base,
            type,
            ...(spiceLocation ? { location: spiceLocation as "door" | "interior" | "pullout" } : {}),
          };
          break;
        case "knife_organizer":
          component = { ...base, type };
          break;
        case "utensil_divider":
          component = { ...base, type, removable };
          break;
        case "drawer_divider": {
          const countN = parseOptionalPositiveInt(dividerCount, "Count");
          component = {
            ...base,
            type,
            removable,
            ...(dividerOrientation
              ? { orientation: dividerOrientation as "vertical" | "horizontal" | "grid" }
              : {}),
            ...(countN !== undefined ? { count: countN } : {}),
          };
          break;
        }
        case "hidden_drawer":
          component = {
            ...base,
            type,
            ...(hiddenLocation
              ? { location: hiddenLocation as "above_drawer" | "inside_cabinet" | "above_trash" | "custom" }
              : {}),
          };
          break;
        case "sink_pullout": {
          const qtyN = parseOptionalPositiveInt(quantity, "Quantity");
          component = {
            ...base,
            type,
            ...(qtyN !== undefined ? { quantity: qtyN } : {}),
          };
          break;
        }
        case "sponge_tilt_out": {
          const qtyN = parseOptionalPositiveInt(quantity, "Quantity");
          component = {
            ...base,
            type,
            ...(qtyN !== undefined ? { quantity: qtyN } : {}),
          };
          break;
        }
        case "custom": {
          const lbl = label.trim();
          if (!lbl) throw new Error("Custom components require a label.");
          component = {
            ...base,
            type,
            label: lbl,
          };
          break;
        }
      }

      // Validate through the shared Zod discriminated union before
      // handing to the parent — same validation the server will do.
      const parsed = cabinetInteriorComponentSchema.safeParse(component);
      if (!parsed.success) {
        return {
          _error: parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "),
        };
      }
      return parsed.data;
    } catch (e: unknown) {
      return { _error: (e as Error).message ?? "Invalid input" };
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = build();
    if ("_error" in result) {
      setError(result._error);
      setSaving(false);
      return;
    }
    try {
      await onSubmit(result);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>Type: <span className="text-gray-200">{INTERIOR_TYPE_LABELS[type]}</span></span>
        {allowSwitchType && (
          <button
            type="button"
            onClick={onSwitchType}
            className="text-[10px] underline underline-offset-2 hover:text-gray-300"
          >
            Change type
          </button>
        )}
      </div>

      {/* Label — required for custom, optional for everything else */}
      <FieldRow label={type === "custom" ? "Label (required)" : "Label (optional)"}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inputCls}
          placeholder={INTERIOR_TYPE_LABELS[type]}
        />
      </FieldRow>

      <FieldRow label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </FieldRow>

      {/* Target */}
      <FieldRow label={requiresDrawerTarget ? "Target (drawer required)" : "Target"}>
        <TargetPicker
          value={target}
          onChange={setTarget}
          cabinet={cabinet}
          requireDrawer={requiresDrawerTarget}
        />
      </FieldRow>

      {/* Type-specific fields */}
      {type === "rollout" && (
        <>
          <FieldRow label="Quantity (optional)">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
              placeholder="—"
            />
          </FieldRow>
          <CheckboxRow label="Open sides" checked={openSides} onChange={setOpenSides} />
        </>
      )}

      {type === "trash_pullout" && (
        <>
          <FieldRow label="Bins (required)">
            <input
              type="number"
              min="1"
              step="1"
              value={bins}
              onChange={(e) => setBins(e.target.value)}
              className={inputCls}
              placeholder="e.g. 2"
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Bin size (qt, optional)">
              <input
                type="number"
                min="0"
                step="0.5"
                value={nominalBinSizeQt}
                onChange={(e) => setNominalBinSizeQt(e.target.value)}
                className={inputCls}
                placeholder="e.g. 35"
              />
            </FieldRow>
            <FieldRow label="Configuration (optional)">
              <select
                value={configuration}
                onChange={(e) => setConfiguration(e.target.value)}
                className={inputCls}
              >
                <option value="">— unset —</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
              </select>
            </FieldRow>
          </div>
        </>
      )}

      {type === "tray_divider" && (
        <FieldRow label="Quantity (optional)">
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputCls}
            placeholder="—"
          />
        </FieldRow>
      )}

      {type === "spice_rack" && (
        <FieldRow label="Location (optional)">
          <select
            value={spiceLocation}
            onChange={(e) => setSpiceLocation(e.target.value)}
            className={inputCls}
          >
            <option value="">— unset —</option>
            <option value="interior">Interior</option>
            <option value="door">Door</option>
            <option value="pullout">Pullout</option>
          </select>
        </FieldRow>
      )}

      {type === "utensil_divider" && (
        <CheckboxRow label="Removable" checked={removable} onChange={setRemovable} />
      )}

      {type === "drawer_divider" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Orientation (optional)">
              <select
                value={dividerOrientation}
                onChange={(e) => setDividerOrientation(e.target.value)}
                className={inputCls}
              >
                <option value="">— unset —</option>
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
                <option value="grid">Grid</option>
              </select>
            </FieldRow>
            <FieldRow label="Count (optional)">
              <input
                type="number"
                min="1"
                step="1"
                value={dividerCount}
                onChange={(e) => setDividerCount(e.target.value)}
                className={inputCls}
                placeholder="—"
              />
            </FieldRow>
          </div>
          <CheckboxRow label="Removable" checked={removable} onChange={setRemovable} />
        </>
      )}

      {type === "hidden_drawer" && (
        <FieldRow label="Location (optional)">
          <select
            value={hiddenLocation}
            onChange={(e) => setHiddenLocation(e.target.value)}
            className={inputCls}
          >
            <option value="">— unset —</option>
            <option value="inside_cabinet">Inside cabinet</option>
            <option value="above_drawer">Above drawer</option>
            <option value="above_trash">Above trash</option>
            <option value="custom">Custom</option>
          </select>
        </FieldRow>
      )}

      {(type === "sink_pullout" || type === "sponge_tilt_out") && (
        <FieldRow label="Quantity (optional)">
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputCls}
            placeholder="—"
          />
        </FieldRow>
      )}

      <CheckboxRow label="Enabled" checked={enabled} onChange={setEnabled} />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">
          Cancel
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50"
          style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add component"}
        </button>
      </div>
    </div>
  );
}

// ─── Target picker ─────────────────────────────────────────────────

function TargetPicker({
  value,
  onChange,
  cabinet,
  requireDrawer,
}: {
  value: InteriorComponentTarget | undefined;
  onChange: (t: InteriorComponentTarget | undefined) => void;
  cabinet: InteriorCabinetContext;
  requireDrawer: boolean;
}) {
  // Serialize as "kind" or "kind:index" for the <select>.
  const serialized = useMemo(() => {
    if (!value) return "";
    if (value.kind === "cabinet") return "cabinet";
    return `${value.kind}:${value.index}`;
  }, [value]);

  function parseAndChange(v: string) {
    if (v === "") {
      onChange(undefined);
      return;
    }
    if (v === "cabinet") {
      onChange({ kind: "cabinet" });
      return;
    }
    const [kind, idxStr] = v.split(":");
    const index = Number(idxStr);
    if (!Number.isFinite(index) || index < 0) {
      onChange(undefined);
      return;
    }
    if (kind === "drawer") onChange({ kind: "drawer", index });
    else if (kind === "door") onChange({ kind: "door", index });
    else if (kind === "shelf") onChange({ kind: "shelf", index });
  }

  const options: Array<{ value: string; label: string }> = [];
  if (!requireDrawer) options.push({ value: "cabinet", label: humanTargetLabel("cabinet") });
  for (let i = 0; i < cabinet.drawerCount; i++) {
    options.push({ value: `drawer:${i}`, label: humanTargetLabel("drawer", i) });
  }
  if (!requireDrawer) {
    for (let i = 0; i < cabinet.doorCount; i++) {
      options.push({ value: `door:${i}`, label: humanTargetLabel("door", i) });
    }
    for (let i = 0; i < cabinet.shelfCount; i++) {
      options.push({ value: `shelf:${i}`, label: humanTargetLabel("shelf", i) });
    }
  }

  return (
    <>
      <select value={serialized} onChange={(e) => parseAndChange(e.target.value)} className={inputCls}>
        <option value="">{requireDrawer ? "— pick a drawer —" : "— no target —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value && value.kind !== "cabinet" && value.index >= countFor(cabinet, value.kind) && (
        <p className="text-[10px] mt-1" style={{ color: "#c8852a" }}>
          Warning: {INTERIOR_TARGET_KIND_LABELS[value.kind]} {value.index + 1} does not exist on this cabinet
          ({countFor(cabinet, value.kind)} available).
        </p>
      )}
    </>
  );
}

function countFor(cabinet: InteriorCabinetContext, kind: InteriorTargetKind): number {
  if (kind === "drawer") return cabinet.drawerCount;
  if (kind === "door") return cabinet.doorCount;
  if (kind === "shelf") return cabinet.shelfCount;
  return 1;
}

// ─── UI primitives ─────────────────────────────────────────────────

const inputCls =
  "w-full text-xs rounded-md px-2 py-1.5 text-white bg-[#1A1E26] border border-[#2E3240] focus:outline-none focus:border-[#3a4a70]";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ─── Number parsers (throwing on non-positive) ─────────────────────

function parsePositiveInt(v: string, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function parseOptionalPositiveInt(v: string, name: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  return parsePositiveInt(t, name);
}

function parseOptionalPositiveNumber(v: string, name: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return n;
}
