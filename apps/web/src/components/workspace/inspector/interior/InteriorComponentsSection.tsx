"use client";

// Phase 3.0 — Interior Components section for the Cabinet Inspector.
//
// New sibling to CabinetSystemsSection (per design decision #1). Reads
// interior components + interiorReadiness from the same effective-
// systems endpoint the Systems section already consumes, and PATCHes
// the cabinet with an atomic array replacement.
//
// Server is authoritative on both authorization
// (`canAssignCabinetSystems`) and validation
// (`cabinetInteriorComponentsArraySchema`). This component's role gate
// only controls whether Add / Edit / Remove / reorder / enable-toggle
// / reset UI renders.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canAssignCabinetSystems } from "@/lib/authz";
import {
  addInteriorComponent,
  buildInteriorComponentsPatch,
  isLinkedInteriorComponent,
  readInteriorComponentsSafe,
  removeInteriorComponent,
  reorderInteriorComponents,
  setInteriorComponentEnabled,
  updateInteriorComponent,
  type CabinetInteriorComponent,
  type InteriorCabinetContext,
  type InteriorReadinessIssue,
  type StandaloneInteriorComponent,
} from "@woodcraft/shared";
import type { CabinetType } from "@woodcraft/shared";
import { InteriorComponentEditor } from "./InteriorComponentEditor";
import { INTERIOR_TYPE_LABELS, humanTargetLabel } from "./type-labels";

interface Props {
  projectId: string;
  roomId: string;
  cabinetId: string;
}

interface CabinetSummary {
  id: string;
  type: string;
  parameters: Record<string, unknown> | null;
}

interface EffectiveSystemsPayload {
  interiorReadiness?: InteriorReadinessIssue[];
}

export function InteriorComponentsSection({ projectId, roomId, cabinetId }: Props) {
  const [cabinet, setCabinet] = useState<CabinetSummary | null>(null);
  const [interiorReadiness, setInteriorReadiness] = useState<InteriorReadinessIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StandaloneInteriorComponent | null>(null);
  const [creating, setCreating] = useState(false);

  const role = useAuthStore((s) => s.user?.role);
  const canEdit = canAssignCabinetSystems(role);

  // Phase 3.1a safe read. `unreadable` is NEVER treated as an empty list:
  // every Add/Edit/Remove/reorder/toggle PATCHes the WHOLE array, so an
  // empty-looking list over real stored data would destroy it.
  const readResult = useMemo(
    () => readInteriorComponentsSafe(cabinet?.parameters),
    [cabinet?.parameters],
  );
  const components = useMemo(
    () => (readResult.status === "ok" ? readResult.components : []),
    [readResult],
  );
  // Components linked to a shop standard come from a newer version
  // (3.1b+). This version cannot resolve them, so the whole array is
  // read-only — the server enforces the same rule independently.
  const hasLinked = components.some(isLinkedInteriorComponent);
  const canMutate = canEdit && readResult.status === "ok" && !hasLinked;

  const cabinetCtx: InteriorCabinetContext | null = useMemo(() => {
    if (!cabinet) return null;
    const p = cabinet.parameters ?? {};
    return {
      cabinetType: (cabinet.type as CabinetType),
      doorCount: readInt(p, "doorCount"),
      drawerCount: readInt(p, "drawerCount"),
      shelfCount: readInt(p, "shelfCount"),
    };
  }, [cabinet]);

  const refetchReadiness = useCallback(async () => {
    const p = await apiClient
      .get<EffectiveSystemsPayload>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-systems`,
      )
      .catch(() => ({} as EffectiveSystemsPayload));
    setInteriorReadiness(p.interiorReadiness ?? []);
  }, [projectId, roomId, cabinetId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<CabinetSummary>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}`,
      ),
      apiClient
        .get<EffectiveSystemsPayload>(
          `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-systems`,
        )
        .catch(() => ({} as EffectiveSystemsPayload)),
    ])
      .then(([cab, eff]) => {
        if (cancelled) return;
        setCabinet(cab);
        setInteriorReadiness(eff.interiorReadiness ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId, roomId, cabinetId]);

  const patchArray = useCallback(
    async (nextArray: CabinetInteriorComponent[]) => {
      // Defense in depth — no control renders when !canMutate.
      if (!canMutate) return;
      setSaving(true);
      setSaveError(null);
      try {
        const updated = await apiClient.patch<CabinetSummary>(
          `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}`,
          buildInteriorComponentsPatch(nextArray),
        );
        setCabinet(updated);
        await refetchReadiness();
      } catch (e: unknown) {
        setSaveError((e as Error).message ?? "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [projectId, roomId, cabinetId, refetchReadiness, canMutate],
  );

  const handleAdd = useCallback(
    async (component: CabinetInteriorComponent) => {
      await patchArray(addInteriorComponent(components, component));
      setCreating(false);
    },
    [patchArray, components],
  );
  const handleUpdate = useCallback(
    async (component: CabinetInteriorComponent) => {
      await patchArray(updateInteriorComponent(components, component.id, component));
      setEditing(null);
    },
    [patchArray, components],
  );
  const handleRemove = useCallback(
    async (id: string) => {
      if (!window.confirm("Remove this interior component?")) return;
      await patchArray(removeInteriorComponent(components, id));
    },
    [patchArray, components],
  );
  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await patchArray(setInteriorComponentEnabled(components, id, enabled));
    },
    [patchArray, components],
  );
  const handleMove = useCallback(
    async (id: string, direction: -1 | 1) => {
      const ids = components.map((c) => c.id);
      const idx = ids.indexOf(id);
      const next = idx + direction;
      if (idx < 0 || next < 0 || next >= ids.length) return;
      [ids[idx], ids[next]] = [ids[next]!, ids[idx]!];
      await patchArray(reorderInteriorComponents(components, ids));
    },
    [patchArray, components],
  );

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Interior Components</p>
        <p className="text-gray-500 text-xs">Loading…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Interior Components</p>
        <p className="text-red-400 text-xs">{error}</p>
      </section>
    );
  }
  if (!cabinet || !cabinetCtx) return null;

  if (readResult.status === "unreadable") {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Interior Components</p>
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828", color: "#c8852a" }}
        >
          Interior components cannot be safely read by this version. They have been left
          unchanged; editing is disabled.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-400 text-xs uppercase tracking-wider">
          Interior Components
          {!canMutate && (
            <span className="ml-2 text-[9px] normal-case tracking-normal" style={{ color: "#8b96a8" }}>
              · read-only
            </span>
          )}
        </p>
        {canMutate && (
          <button
            onClick={() => setCreating(true)}
            disabled={saving}
            className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2 disabled:opacity-50"
          >
            + Add component
          </button>
        )}
      </div>

      {hasLinked && (
        <div
          className="mb-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828", color: "#c8852a" }}
        >
          This cabinet uses linked shop standards from a newer version. They are shown
          as stored and cannot be edited here.
        </div>
      )}

      {components.length === 0 ? (
        <p className="text-[11px] text-gray-600">No interior components yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {components.map((c, i) => (
            <li
              key={c.id}
              className="rounded-md p-2"
              style={{ background: "#151920", border: "1px solid #22262E" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[12px]">
                    {c.label ?? INTERIOR_TYPE_LABELS[c.type]}
                    {!c.enabled && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider" style={{ color: "#8b96a8" }}>
                        · disabled
                      </span>
                    )}
                    {isLinkedInteriorComponent(c) && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider" style={{ color: "#c8852a" }}>
                        · linked standard unavailable
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{summarize(c)}</p>
                </div>
                {canMutate && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => void handleMove(c.id, -1)}
                      disabled={saving || i === 0}
                      title="Move up"
                      className="text-[10px] text-gray-500 hover:text-gray-200 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => void handleMove(c.id, +1)}
                      disabled={saving || i === components.length - 1}
                      title="Move down"
                      className="text-[10px] text-gray-500 hover:text-gray-200 disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => void handleToggle(c.id, !c.enabled)}
                      disabled={saving}
                      className="text-[10px] text-gray-500 hover:text-gray-200 underline underline-offset-2"
                    >
                      {c.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => {
                        if (!isLinkedInteriorComponent(c)) setEditing(c);
                      }}
                      disabled={saving}
                      className="text-[10px] text-gray-500 hover:text-white underline underline-offset-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleRemove(c.id)}
                      disabled={saving}
                      className="text-[10px] text-gray-500 hover:text-red-300 underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {saveError && (
        <div
          className="mt-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{ background: "rgba(200,60,60,0.08)", border: "1px solid #6a2828", color: "#e07070" }}
        >
          {saveError}
        </div>
      )}

      {interiorReadiness.length > 0 && (
        <div
          className="mt-3 rounded-md px-2 py-1.5"
          style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828" }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#c8852a" }}>
            Interior readiness ({interiorReadiness.length})
          </p>
          <ul className="space-y-0.5">
            {interiorReadiness.slice(0, 8).map((w, i) => (
              <li key={i} className="text-[11px]" style={{ color: "#c8852a" }}>
                ⚠ [{w.code}] {w.detail}
              </li>
            ))}
            {interiorReadiness.length > 8 && (
              <li className="text-[10px] text-gray-500">
                …and {interiorReadiness.length - 8} more.
              </li>
            )}
          </ul>
        </div>
      )}

      {canMutate && (creating || editing) && cabinetCtx && (
        <InteriorComponentEditor
          initial={editing}
          cabinet={cabinetCtx}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={editing ? handleUpdate : handleAdd}
        />
      )}
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function readInt(p: Record<string, unknown> | null | undefined, key: string): number {
  if (!p) return 0;
  const v = p[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function summarize(c: CabinetInteriorComponent): string {
  const parts: string[] = [];

  switch (c.type) {
    case "rollout":
      if (c.quantity != null) parts.push(`qty ${c.quantity}`);
      if (c.openSides) parts.push("open sides");
      break;
    case "trash_pullout":
      // `bins` is always present on standalone components; a linked one
      // stores overrides only and may omit it.
      if (c.configuration) parts.push(`${c.configuration}`);
      else if (c.bins != null) parts.push(`${c.bins} bin${c.bins === 1 ? "" : "s"}`);
      if (c.nominalBinSizeQt != null) parts.push(`${c.nominalBinSizeQt} qt`);
      break;
    case "tray_divider":
      if (c.quantity != null) parts.push(`qty ${c.quantity}`);
      break;
    case "spice_rack":
      if (c.location) parts.push(c.location);
      break;
    case "drawer_divider":
      if (c.orientation) parts.push(c.orientation);
      if (c.count != null) parts.push(`${c.count} slots`);
      if (c.removable) parts.push("removable");
      break;
    case "utensil_divider":
      if (c.removable) parts.push("removable");
      break;
    case "hidden_drawer":
      if (c.location) parts.push(c.location.replace(/_/g, " "));
      break;
    case "sink_pullout":
    case "sponge_tilt_out":
      if (c.quantity != null) parts.push(`qty ${c.quantity}`);
      break;
    case "knife_organizer":
    case "custom":
      break;
  }

  if (c.target) {
    parts.push(
      c.target.kind === "cabinet"
        ? humanTargetLabel("cabinet")
        : humanTargetLabel(c.target.kind, c.target.index),
    );
  }
  return parts.join(" · ") || "—";
}
