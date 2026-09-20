"use client";

// Reusable Org / Project / Room system-defaults panel.
//
// Same shape at all three scopes:
//   - familyRuleIdsByCabinetType per CabinetType
//   - preferredFrontSystemId
//   - preferredDrawerSystemId
//
// Three-state per key. Selecting "Inherit" sends `null`; selecting a
// system id sends the id; leaving unchanged omits the key from the
// PATCH body. `familyRuleIdsByCabinetType` object omits keys that were
// not touched, so sibling keys are preserved.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  canAssignCabinetSystems,
  canManageOrganizationStandards,
} from "@/lib/authz";
import {
  CABINET_TYPES,
  cabinetTypeLabel,
  type CabinetType,
  type DrawerSystem,
  type FamilyRule,
  type FrontSystem,
  type OrgAssignments,
} from "./shared";

type AssignmentScope = "organization" | "project" | "room";

interface Props {
  scope: AssignmentScope;
  projectId?: string;    // required for project + room scopes
  roomId?: string;       // required for room scope
  title?: string;
  inheritLabel?: string; // dropdown label for the "clear" option
  helpText?: string;
}

const ENDPOINTS: Record<AssignmentScope, (ids: Record<string, string>) => string> = {
  organization: () => `/organization/system-assignments`,
  project:      (ids) => `/projects/${ids.projectId}/system-assignments`,
  room:         (ids) => `/projects/${ids.projectId}/rooms/${ids.roomId}/system-assignments`,
};

export function AssignmentsPanel({
  scope,
  projectId,
  roomId,
  title,
  inheritLabel,
  helpText,
}: Props) {
  const endpoint = useMemo(
    () =>
      ENDPOINTS[scope]({
        projectId: projectId ?? "",
        roomId: roomId ?? "",
      }),
    [scope, projectId, roomId],
  );

  const [assignments, setAssignments] = useState<OrgAssignments | null>(null);
  const [familyRules, setFamilyRules]   = useState<FamilyRule[]>([]);
  const [frontSystems, setFrontSystems] = useState<FrontSystem[]>([]);
  const [drawerSystems, setDrawerSystems] = useState<DrawerSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState<string | null>(null);   // key currently saving
  const [saveError, setSaveError] = useState<string | null>(null);

  const role = useAuthStore((s) => s.user?.role);
  // Org defaults require owner/admin; project + room require assign perm.
  const canEdit =
    scope === "organization"
      ? canManageOrganizationStandards(role)
      : canAssignCabinetSystems(role);

  const refetch = useCallback(async () => {
    const a = await apiClient.get<OrgAssignments>(endpoint);
    setAssignments(a ?? {});
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient.get<OrgAssignments>(endpoint).catch(() => ({} as OrgAssignments)),
      apiClient.get<FamilyRule[]>(`/systems/family-rules`).catch(() => []),
      apiClient.get<FrontSystem[]>(`/systems/fronts`).catch(() => []),
      apiClient.get<DrawerSystem[]>(`/systems/drawers`).catch(() => []),
    ])
      .then(([a, fam, fr, dr]) => {
        if (cancelled) return;
        setAssignments(a ?? {});
        setFamilyRules(fam);
        setFrontSystems(fr);
        setDrawerSystems(dr);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint]);

  const patchAssignments = useCallback(
    async (body: Record<string, unknown>, savingKey: string) => {
      setSaving(savingKey);
      setSaveError(null);
      try {
        await apiClient.patch(endpoint, body);
        await refetch();
      } catch (e: unknown) {
        setSaveError((e as Error).message ?? "Save failed");
      } finally {
        setSaving(null);
      }
    },
    [endpoint, refetch],
  );

  const onFamilyChange = (type: CabinetType, next: string) => {
    return patchAssignments(
      { familyRuleIdsByCabinetType: { [type]: next === "" ? null : next } },
      `family:${type}`,
    );
  };
  const onFrontChange = (next: string) => {
    return patchAssignments(
      { preferredFrontSystemId: next === "" ? null : next },
      "front",
    );
  };
  const onDrawerChange = (next: string) => {
    return patchAssignments(
      { preferredDrawerSystemId: next === "" ? null : next },
      "drawer",
    );
  };

  if (loading) return <p className="text-gray-500 text-xs">Loading…</p>;
  if (error)   return <p className="text-red-400 text-xs">{error}</p>;
  if (!assignments) return null;

  const currentFamilyMap = assignments.familyRuleIdsByCabinetType ?? {};

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider">{title}</p>
        </div>
      )}
      {helpText && <p className="text-[11px] text-gray-500 mb-3">{helpText}</p>}
      {!canEdit && (
        <p className="text-[11px] mb-3" style={{ color: "#8b96a8" }}>
          Read-only · your role does not permit changes at this scope.
        </p>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-2">
            Family rules by cabinet type
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CABINET_TYPES.map((t) => (
              <label key={t} className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">{cabinetTypeLabel(t)}</span>
                <select
                  disabled={!canEdit || saving === `family:${t}`}
                  value={currentFamilyMap[t] ?? ""}
                  onChange={(e) => onFamilyChange(t, e.target.value)}
                  className="w-full text-xs rounded-md px-2 py-1.5 text-white bg-[#1A1E26] border border-[#2E3240]"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">{inheritLabel ?? "Inherit / Unassigned"}</option>
                  {familyRules.filter((r) => r.cabinetType === t).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Preferred front system</span>
            <select
              disabled={!canEdit || saving === "front"}
              value={assignments.preferredFrontSystemId ?? ""}
              onChange={(e) => onFrontChange(e.target.value)}
              className="w-full text-xs rounded-md px-2 py-1.5 text-white bg-[#1A1E26] border border-[#2E3240]"
              style={{ colorScheme: "dark" }}
            >
              <option value="">{inheritLabel ?? "Inherit / Unassigned"}</option>
              {frontSystems.map((r) => (
                <option key={r.id} value={r.id}>{r.name} · {r.kind}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Preferred drawer system</span>
            <select
              disabled={!canEdit || saving === "drawer"}
              value={assignments.preferredDrawerSystemId ?? ""}
              onChange={(e) => onDrawerChange(e.target.value)}
              className="w-full text-xs rounded-md px-2 py-1.5 text-white bg-[#1A1E26] border border-[#2E3240]"
              style={{ colorScheme: "dark" }}
            >
              <option value="">{inheritLabel ?? "Inherit / Unassigned"}</option>
              {drawerSystems.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.kind === "proprietary" ? (r.proprietaryFamily ?? "proprietary") : "traditional"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
      </div>
    </div>
  );
}
