"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canManageOrganizationStandards } from "@/lib/authz";
import { DRAWER_JOINERIES, type DrawerSystem } from "./shared";

const TRAD_KEYS = [
  "boxSideThicknessMm",
  "boxBottomThicknessMm",
  "boxBackThicknessMm",
  "boxSubFrontThicknessMm",
] as const;
const TRAD_LABELS: Record<(typeof TRAD_KEYS)[number], string> = {
  boxSideThicknessMm: "Side thk",
  boxBottomThicknessMm: "Bottom thk",
  boxBackThicknessMm: "Back thk",
  boxSubFrontThicknessMm: "Sub-front thk",
};

export function DrawerSystemsTab() {
  const [rows, setRows] = useState<DrawerSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DrawerSystem | null>(null);
  const [creating, setCreating] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const canManage = canManageOrganizationStandards(role);

  const refresh = useCallback(() => {
    apiClient
      .get<DrawerSystem[]>(`/systems/drawers`)
      .then(setRows)
      .catch((e: unknown) => setError((e as Error).message ?? "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Drawer Systems</p>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded-md text-white"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            + New Drawer System
          </button>
        )}
      </div>
      {!canManage && (
        <p className="text-[11px] mb-3" style={{ color: "#8b96a8" }}>
          Read-only · only owners and admins can create or edit reusable system definitions.
        </p>
      )}

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {rows === null ? (
        <p className="text-gray-500 text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-xs">No drawer systems yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <DrawerCard key={r.id} row={r} onEdit={canManage ? () => setEditing(r) : undefined} />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <DrawerEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { refresh(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function DrawerCard({ row, onEdit }: { row: DrawerSystem; onEdit?: () => void }) {
  return (
    <div className="rounded-md p-3 flex items-start justify-between gap-3"
      style={{ background: "#151920", border: "1px solid #22262E" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm">{row.name}</p>
          <span className="text-gray-500 text-[11px]">{row.kind}</span>
          {row.proprietaryFamily && <span className="text-gray-400 text-[10px]">· {row.proprietaryFamily}</span>}
          {row.boxJoinery && <span className="text-gray-400 text-[10px]">· {row.boxJoinery}</span>}
        </div>
        {row.kind === "traditional" && (
          <p className="text-gray-500 text-[11px] mt-1">
            {TRAD_KEYS.map((k) => row[k] !== null ? `${TRAD_LABELS[k]} ${row[k]}mm` : null)
              .filter(Boolean).join(" · ") || <span className="italic">No thicknesses populated</span>}
          </p>
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="text-[11px] text-gray-400 hover:text-white underline underline-offset-2">
          Edit
        </button>
      )}
    </div>
  );
}

function DrawerEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: DrawerSystem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [name, setName]         = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind]         = useState<"traditional" | "proprietary">(initial?.kind ?? "traditional");
  const [proprietaryFamily, setProprietaryFamily] = useState(initial?.proprietaryFamily ?? "");
  const [boxJoinery, setBoxJoinery] = useState(initial?.boxJoinery ?? "");
  const [dims, setDims] = useState<Record<(typeof TRAD_KEYS)[number], string>>({
    boxSideThicknessMm:     (initial?.boxSideThicknessMm ?? "").toString(),
    boxBottomThicknessMm:   (initial?.boxBottomThicknessMm ?? "").toString(),
    boxBackThicknessMm:     (initial?.boxBackThicknessMm ?? "").toString(),
    boxSubFrontThicknessMm: (initial?.boxSubFrontThicknessMm ?? "").toString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const wasTraditional = initial?.kind === "traditional";
  const wasProprietary = initial?.kind === "proprietary";
  const kindChanging   = initial && initial.kind !== kind;
  const requiresStripToProprietary = kindChanging && wasTraditional && kind === "proprietary";
  const requiresStripToTraditional = kindChanging && wasProprietary && kind === "traditional";

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        kind,
      };
      if (kind === "traditional") {
        body.proprietaryFamily = null;
        body.boxJoinery = boxJoinery || null;
        for (const k of TRAD_KEYS) {
          const raw = dims[k];
          if (raw === "" || raw === undefined) body[k] = null;
          else {
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) throw new Error(`${TRAD_LABELS[k]} must be a positive number`);
            body[k] = n;
          }
        }
      } else {
        body.proprietaryFamily = proprietaryFamily.trim();
        if (!body.proprietaryFamily) throw new Error("Proprietary family is required");
        body.boxJoinery = null;
        for (const k of TRAD_KEYS) body[k] = null;
      }
      if (isNew) await apiClient.post(`/systems/drawers`, body);
      else       await apiClient.patch(`/systems/drawers/${initial!.id}`, body);
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isNew ? "New Drawer System" : `Edit — ${initial!.name}`} onClose={onClose}>
      <div className="space-y-4">
        <FieldRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </FieldRow>
        <FieldRow label="Description">
          <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </FieldRow>
        <FieldRow label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as "traditional" | "proprietary")}
            className={inputCls}>
            <option value="traditional">Traditional</option>
            <option value="proprietary">Proprietary</option>
          </select>
        </FieldRow>

        {kindChanging && (
          <div
            className="rounded-md px-2 py-1.5 text-[11px]"
            style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828", color: "#c8852a" }}
          >
            Changing kind. On save, the other-variant fields will be cleared:
            {requiresStripToProprietary && (
              <span> traditional thicknesses + joinery removed.</span>
            )}
            {requiresStripToTraditional && (
              <span> proprietary family removed.</span>
            )}
          </div>
        )}

        {kind === "traditional" ? (
          <>
            <FieldRow label="Joinery">
              <select value={boxJoinery ?? ""} onChange={(e) => setBoxJoinery(e.target.value)} className={inputCls}>
                <option value="">— unset —</option>
                {DRAWER_JOINERIES.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </FieldRow>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Thicknesses (mm)</p>
              <div className="grid grid-cols-2 gap-3">
                {TRAD_KEYS.map((k) => (
                  <FieldRow key={k} label={TRAD_LABELS[k]}>
                    <input
                      type="number"
                      step="0.001"
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
          </>
        ) : (
          <FieldRow label="Proprietary family">
            <input
              value={proprietaryFamily}
              onChange={(e) => setProprietaryFamily(e.target.value)}
              className={inputCls}
              placeholder="e.g. Blum Legrabox"
            />
          </FieldRow>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            className="text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            {saving ? "Saving…" : isNew ? "Create drawer system" : "Save changes"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Shared internals ─────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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
