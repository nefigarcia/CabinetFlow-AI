"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canManageOrganizationStandards } from "@/lib/authz";
import {
  cabinetTypeLabel,
  CABINET_TYPES,
  CORNER_VARIANTS,
  FIXED_SHELF_POLICIES,
  mmDisplay,
  type CabinetType,
  type FamilyRule,
} from "./shared";

const DIM_KEYS = [
  "toeHeightMm",
  "toeRecessMm",
  "topRevealMm",
  "bottomRevealMm",
  "topScribeMm",
  "bottomScribeMm",
] as const;
const DIM_LABELS: Record<(typeof DIM_KEYS)[number], string> = {
  toeHeightMm: "Toe height",
  toeRecessMm: "Toe recess",
  topRevealMm: "Top reveal",
  bottomRevealMm: "Bottom reveal",
  topScribeMm: "Top scribe",
  bottomScribeMm: "Bottom scribe",
};

export function FamilyRulesTab() {
  const [rows, setRows] = useState<FamilyRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FamilyRule | null>(null);
  const [creating, setCreating] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const canManage = canManageOrganizationStandards(role);

  const refresh = useCallback(() => {
    apiClient
      .get<FamilyRule[]>(`/systems/family-rules`)
      .then(setRows)
      .catch((e: unknown) => setError((e as Error).message ?? "Failed to load"));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Family Rules</p>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded-md text-white"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            + New Family Rule
          </button>
        )}
      </div>
      {!canManage && (
        <p className="text-[11px] mb-3" style={{ color: "#8b96a8" }}>
          Read-only · only owners and admins can create or edit reusable system definitions.
        </p>
      )}

      {error && (
        <p className="text-red-400 text-xs mb-3">{error}</p>
      )}

      {rows === null ? (
        <p className="text-gray-500 text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-xs">No family rules yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <FamilyRuleCard key={r.id} rule={r} onEdit={canManage ? () => setEditing(r) : undefined} />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <FamilyRuleEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { refresh(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function FamilyRuleCard({ rule, onEdit }: { rule: FamilyRule; onEdit?: () => void }) {
  return (
    <div
      className="rounded-md p-3 flex items-start justify-between gap-3"
      style={{ background: "#151920", border: "1px solid #22262E" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm">{rule.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider text-gray-400"
            style={{ background: "#1a1e26", border: "1px solid #2a2e38" }}
          >
            {cabinetTypeLabel(rule.cabinetType)}
          </span>
          <VerifyPill status={rule.verificationStatus} />
        </div>
        <p className="text-gray-500 text-[11px] mt-1">
          {DIM_KEYS.map((k) => rule[k] !== null ? `${DIM_LABELS[k]} ${rule[k]}mm` : null)
            .filter(Boolean)
            .slice(0, 3)
            .join(" · ") || <span className="italic">No dimensions populated</span>}
        </p>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-[11px] text-gray-400 hover:text-white underline underline-offset-2"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function FamilyRuleEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: FamilyRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [name, setName]                 = useState(initial?.name ?? "");
  const [description, setDescription]   = useState(initial?.description ?? "");
  const [cabinetType, setCabinetType]   = useState<CabinetType>(initial?.cabinetType ?? "base");
  const [hasToeKick, setHasToeKick]     = useState<boolean | null>(initial?.hasToeKick ?? null);
  const [hasBack, setHasBack]           = useState<boolean | null>(initial?.hasBack ?? null);
  const [hasNailer, setHasNailer]       = useState<boolean | null>(initial?.hasNailer ?? null);
  const [fixedShelfPolicy, setFixedShelfPolicy] = useState<string | null>(initial?.fixedShelfPolicy ?? null);
  const [cornerVariant, setCornerVariant]       = useState<string | null>(initial?.cornerVariant ?? null);

  const [dims, setDims] = useState<Record<(typeof DIM_KEYS)[number], string>>({
    toeHeightMm:    (initial?.toeHeightMm ?? "").toString(),
    toeRecessMm:    (initial?.toeRecessMm ?? "").toString(),
    topRevealMm:    (initial?.topRevealMm ?? "").toString(),
    bottomRevealMm: (initial?.bottomRevealMm ?? "").toString(),
    topScribeMm:    (initial?.topScribeMm ?? "").toString(),
    bottomScribeMm: (initial?.bottomScribeMm ?? "").toString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        cabinetType,
        hasToeKick,
        hasBack,
        hasNailer,
        fixedShelfPolicy: fixedShelfPolicy || null,
        cornerVariant: cornerVariant || null,
      };
      for (const k of DIM_KEYS) {
        const raw = dims[k];
        if (raw === "" || raw === undefined) body[k] = null;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) throw new Error(`${DIM_LABELS[k]} must be a non-negative number`);
          body[k] = n;
        }
      }
      if (isNew) {
        await apiClient.post(`/systems/family-rules`, body);
      } else {
        await apiClient.patch(`/systems/family-rules/${initial!.id}`, body);
      }
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isNew ? "New Family Rule" : `Edit — ${initial!.name}`} onClose={onClose}>
      <div className="space-y-4">
        <FieldRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </FieldRow>
        <FieldRow label="Description">
          <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </FieldRow>
        <FieldRow label="Cabinet Type">
          <select value={cabinetType} onChange={(e) => setCabinetType(e.target.value as CabinetType)}
            className={inputCls} disabled={!isNew}>
            {CABINET_TYPES.map((t) => (
              <option key={t} value={t}>{cabinetTypeLabel(t)}</option>
            ))}
          </select>
          {!isNew && (
            <p className="text-[10px] text-gray-500 mt-1">
              Cabinet type is fixed after creation. Create a new rule for a different type.
            </p>
          )}
        </FieldRow>

        <div className="grid grid-cols-3 gap-3">
          <TriBool label="Has toe kick" value={hasToeKick} onChange={setHasToeKick} />
          <TriBool label="Has back"     value={hasBack}    onChange={setHasBack} />
          <TriBool label="Has nailer"   value={hasNailer}  onChange={setHasNailer} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Fixed shelf policy">
            <select value={fixedShelfPolicy ?? ""} onChange={(e) => setFixedShelfPolicy(e.target.value || null)}
              className={inputCls}>
              <option value="">— unset —</option>
              {FIXED_SHELF_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Corner variant">
            <select value={cornerVariant ?? ""} onChange={(e) => setCornerVariant(e.target.value || null)}
              className={inputCls}>
              <option value="">— unset —</option>
              {CORNER_VARIANTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FieldRow>
        </div>

        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Dimensions (mm)</p>
          <div className="grid grid-cols-3 gap-3">
            {DIM_KEYS.map((k) => (
              <FieldRow key={k} label={DIM_LABELS[k]}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dims[k]}
                  onChange={(e) => setDims((d) => ({ ...d, [k]: e.target.value }))}
                  className={inputCls}
                  placeholder="—"
                />
              </FieldRow>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            className="text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            {saving ? "Saving…" : isNew ? "Create rule" : "Save changes"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Shared internal helpers ───────────────────────────────────────────

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

function TriBool({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}) {
  return (
    <FieldRow label={label}>
      <select
        value={value === null ? "" : value ? "true" : "false"}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
        className={inputCls}
      >
        <option value="">— unknown —</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </FieldRow>
  );
}

function VerifyPill({ status }: { status: string }) {
  const cfg =
    status === "verified"
      ? { bg: "rgba(60,160,60,0.10)", border: "#1f4a1f", fg: "#7fbf7f", label: "Verified" }
      : status === "partially_verified"
        ? { bg: "rgba(200,133,42,0.12)", border: "#6a5828", fg: "#c8852a", label: "Partial" }
        : { bg: "rgba(200,60,60,0.10)", border: "#6a2828", fg: "#e07070", label: "Unverified" };
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto"
        style={{ background: "#0f1218", border: "1px solid #22262E" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Silence unused warning — mmDisplay is exported for future consumers.
void mmDisplay;
