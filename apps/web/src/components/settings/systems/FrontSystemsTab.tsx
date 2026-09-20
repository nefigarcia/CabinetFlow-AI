"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canManageOrganizationStandards } from "@/lib/authz";
import { FRONT_KINDS, FRONT_ROLES, humanKind, type FrontSystem } from "./shared";

export function FrontSystemsTab() {
  const [rows, setRows] = useState<FrontSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FrontSystem | null>(null);
  const [creating, setCreating] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const canManage = canManageOrganizationStandards(role);

  const refresh = useCallback(() => {
    apiClient
      .get<FrontSystem[]>(`/systems/fronts`)
      .then(setRows)
      .catch((e: unknown) => setError((e as Error).message ?? "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Front Systems</p>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded-md text-white"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            + New Front System
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
        <p className="text-gray-600 text-xs">No front systems yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <FrontCard key={r.id} row={r} onEdit={canManage ? () => setEditing(r) : undefined} />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <FrontEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { refresh(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function FrontCard({ row, onEdit }: { row: FrontSystem; onEdit?: () => void }) {
  return (
    <div className="rounded-md p-3 flex items-start justify-between gap-3"
      style={{ background: "#151920", border: "1px solid #22262E" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm">{row.name}</p>
          <span className="text-gray-500 text-[11px]">{humanKind(row.kind)} · {humanKind(row.role)}</span>
          {row.glassFlag && <span className="text-[10px] text-gray-400">· glass</span>}
        </div>
        {row.description && <p className="text-gray-500 text-[11px] mt-1">{row.description}</p>}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="text-[11px] text-gray-400 hover:text-white underline underline-offset-2">
          Edit
        </button>
      )}
    </div>
  );
}

function FrontEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: FrontSystem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [name, setName]         = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind]         = useState<string>(initial?.kind ?? "hinged_single");
  const [role, setRole]         = useState<string>(initial?.role ?? "cabinet_front");
  const [glassFlag, setGlassFlag] = useState<boolean>(initial?.glassFlag ?? false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        description: description || null,
        kind,
        role,
        glassFlag,
      };
      if (isNew) await apiClient.post(`/systems/fronts`, body);
      else       await apiClient.patch(`/systems/fronts/${initial!.id}`, body);
      onSaved();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isNew ? "New Front System" : `Edit — ${initial!.name}`} onClose={onClose}>
      <div className="space-y-4">
        <FieldRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </FieldRow>
        <FieldRow label="Description">
          <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              {FRONT_KINDS.map((k) => <option key={k} value={k}>{humanKind(k)}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {FRONT_ROLES.map((r) => <option key={r} value={r}>{humanKind(r)}</option>)}
            </select>
          </FieldRow>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-gray-300">
          <input type="checkbox" checked={glassFlag} onChange={(e) => setGlassFlag(e.target.checked)} />
          Glass panel
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            className="text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{ background: "#1a2540", border: "1px solid #2a3f66" }}
          >
            {saving ? "Saving…" : isNew ? "Create front system" : "Save changes"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Shared internals (copies of FamilyRulesTab helpers) ──────────────

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
        className="rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
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
