"use client";

// Cabinet Systems section for the CabinetInspector (Phase 2 + 2.1).
//
// Read view: shows the resolved family rule + front + drawer system +
// semantic hardware requirements + Phase 2 readiness warnings.
//
// Assignment view: three dropdowns that PATCH the cabinet's parameter
// bag with `familyRuleId`, `frontSystemId`, `drawerSystemId`, and the
// `disableFamilyRule` boolean. After every PATCH the effective-systems
// payload is refetched — server remains authoritative.
//
// Metadata + readiness only. Server-side PARAMETER_IMPACT = "metadata"
// on all four keys → no CAD recompute, no BOM changes.

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canAssignCabinetSystems } from "@/lib/authz";
import {
  AssignmentPicker,
  cabinetTypeLabel,
  Field,
  SourceBadge,
  VerificationPill,
  type CabinetType,
  type SystemSource,
} from "./systems-ui";

// ─── API payload types (mirror EffectiveSystemsPayload on the server) ─

type FamilyStatus = "resolved" | "unresolved" | "disabled";
type SystemStatus = "resolved" | "unresolved";

interface FamilyRule {
  id: string;
  name: string;
  cabinetType: string;
  hasToeKick: boolean | null;
  hasBack: boolean | null;
  hasNailer: boolean | null;
  fixedShelfPolicy: string | null;
  cornerVariant: string | null;
  toeHeightMm: number | null;
  toeRecessMm: number | null;
  topRevealMm: number | null;
  bottomRevealMm: number | null;
  topScribeMm: number | null;
  bottomScribeMm: number | null;
  verificationStatus: string;
  sourceRef: string | null;
}

interface FrontSystem {
  id: string;
  name: string;
  kind: string;
  role: string;
  glassFlag: boolean;
  verificationStatus: string;
  sourceRef: string | null;
}

interface DrawerSystem {
  id: string;
  name: string;
  kind: "traditional" | "proprietary";
  boxSideThicknessMm: number | null;
  boxBottomThicknessMm: number | null;
  boxBackThicknessMm: number | null;
  boxSubFrontThicknessMm: number | null;
  boxJoinery: string | null;
  proprietaryFamily: string | null;
  verificationStatus: string;
  sourceRef: string | null;
}

interface HardwareRequirement {
  category: string;
  familyHint: string | null;
  quantity: number;
  unit: "piece" | "pair" | "set";
  quantityStatus: "verified" | "unresolved";
  requirements: { softClose?: boolean };
  spec: Record<string, unknown>;
  provenance: { source: string; detail: string };
}

interface EffectiveSystemsPayload {
  family: { rule: FamilyRule | null; status: FamilyStatus; source: SystemSource };
  front:  { system: FrontSystem | null;  status: SystemStatus;  source: SystemSource };
  drawer: { system: DrawerSystem | null; status: SystemStatus;  source: SystemSource };
  hardware: {
    requirements: HardwareRequirement[];
    deferred: boolean;
    deferReason?: string;
  };
  readiness: Array<{ code: string; severity: "warning"; detail: string }>;
}

// ─── Cabinet-parameters + library shapes we need to read ──────────────

interface CabinetSummary {
  id: string;
  roomId: string;
  type: string;
  parameters: Record<string, unknown> | null;
}

// ─── Component ────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  roomId: string;
  cabinetId: string;
}

// Sentinel for the disable-family option in the AssignmentPicker.
const DISABLE_FAMILY = "__disable_family__";

export function CabinetSystemsSection({ projectId, roomId, cabinetId }: Props) {
  const [payload, setPayload] = useState<EffectiveSystemsPayload | null>(null);
  const [cabinet, setCabinet]   = useState<CabinetSummary | null>(null);
  const [familyRules, setFamilyRules] = useState<FamilyRule[] | null>(null);
  const [frontSystems, setFrontSystems] = useState<FrontSystem[] | null>(null);
  const [drawerSystems, setDrawerSystems] = useState<DrawerSystem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const role = useAuthStore((s) => s.user?.role);
  const canAssign = canAssignCabinetSystems(role);

  const cabinetType = cabinet?.type as CabinetType | undefined;

  // Cabinet params — client-side view of the stored override state.
  const storedFamilyId  = cabinet?.parameters
    ? (cabinet.parameters["familyRuleId"] as string | undefined)
    : undefined;
  const storedFrontId   = cabinet?.parameters
    ? (cabinet.parameters["frontSystemId"] as string | undefined)
    : undefined;
  const storedDrawerId  = cabinet?.parameters
    ? (cabinet.parameters["drawerSystemId"] as string | undefined)
    : undefined;
  const storedDisabled  = cabinet?.parameters?.["disableFamilyRule"] === true;

  const doorCount   = readInt(cabinet?.parameters, "doorCount");
  const drawerCount = readInt(cabinet?.parameters, "drawerCount");
  const showDrawer  = drawerCount > 0 || cabinet?.type === "drawer_base" || !!storedDrawerId;

  const refetchEffective = useCallback(async () => {
    const p = await apiClient.get<EffectiveSystemsPayload>(
      `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-systems`,
    );
    setPayload(p);
  }, [projectId, roomId, cabinetId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<EffectiveSystemsPayload>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-systems`,
      ),
      apiClient.get<CabinetSummary>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}`,
      ),
      apiClient.get<FamilyRule[]>(`/systems/family-rules`).catch(() => [] as FamilyRule[]),
      apiClient.get<FrontSystem[]>(`/systems/fronts`).catch(() => [] as FrontSystem[]),
      apiClient.get<DrawerSystem[]>(`/systems/drawers`).catch(() => [] as DrawerSystem[]),
    ])
      .then(([eff, cab, fam, fr, dr]) => {
        if (cancelled) return;
        setPayload(eff);
        setCabinet(cab);
        setFamilyRules(fam);
        setFrontSystems(fr);
        setDrawerSystems(dr);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, roomId, cabinetId]);

  const patchCabinetParams = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      setSaveError(null);
      try {
        const updated = await apiClient.patch<CabinetSummary>(
          `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}`,
          { parameters: patch },
        );
        // Server re-serialized the parameter bag; take that as truth.
        setCabinet(updated);
        await refetchEffective();
      } catch (e: unknown) {
        setSaveError((e as Error).message ?? "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [projectId, roomId, cabinetId, refetchEffective],
  );

  // ─── Handlers ──────────────────────────────────────────────────────

  const onFamilyChange = useCallback(
    (next: string) => {
      if (next === DISABLE_FAMILY) {
        return patchCabinetParams({ disableFamilyRule: true });
      }
      if (next === "") {
        // Inherit: clear override AND re-enable inheritance.
        return patchCabinetParams({ familyRuleId: null, disableFamilyRule: false });
      }
      return patchCabinetParams({ familyRuleId: next, disableFamilyRule: false });
    },
    [patchCabinetParams],
  );

  const onFrontChange = useCallback(
    (next: string) => {
      return patchCabinetParams({ frontSystemId: next === "" ? null : next });
    },
    [patchCabinetParams],
  );

  const onDrawerChange = useCallback(
    (next: string) => {
      return patchCabinetParams({ drawerSystemId: next === "" ? null : next });
    },
    [patchCabinetParams],
  );

  const onReset = useCallback(async () => {
    // Only touches Phase 2 override keys — never doorCount / drawerCount /
    // dimensions / profile refs / materials / wallPlacement.
    await patchCabinetParams({
      familyRuleId: null,
      frontSystemId: null,
      drawerSystemId: null,
      disableFamilyRule: false,
    });
  }, [patchCabinetParams]);

  // ─── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cabinet Systems</p>
        <p className="text-gray-500 text-xs">Loading…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cabinet Systems</p>
        <p className="text-red-400 text-xs">{error}</p>
      </section>
    );
  }
  if (!payload || !cabinet) return null;

  const familyOptions = (familyRules ?? [])
    .filter((r) => r.cabinetType === cabinet.type)
    .map((r) => ({
      value: r.id,
      label: r.name,
      hint: r.verificationStatus,
    }));

  const familySelectValue = storedDisabled
    ? DISABLE_FAMILY
    : storedFamilyId ?? "";
  const anyOverride = !!(storedFamilyId || storedFrontId || storedDrawerId || storedDisabled);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-400 text-xs uppercase tracking-wider">
          Cabinet Systems
          {!canAssign && (
            <span className="ml-2 text-[9px] normal-case tracking-normal" style={{ color: "#8b96a8" }}>
              · read-only
            </span>
          )}
        </p>
        {anyOverride && canAssign && (
          <button
            type="button"
            className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2 disabled:opacity-50"
            disabled={saving}
            onClick={() => {
              if (!window.confirm("Clear cabinet overrides and resume inheritance for family, front, and drawer systems?")) return;
              void onReset();
            }}
          >
            Reset overrides
          </button>
        )}
      </div>

      {/* ── Family Rule ─────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Family Rule</p>
        <EffectiveRow>
          <div className="flex items-center gap-1.5 flex-wrap">
            {payload.family.status === "disabled" ? (
              <span className="text-gray-300 text-[11px]">Standard rule disabled · intentional</span>
            ) : payload.family.status === "resolved" && payload.family.rule ? (
              <>
                <span className="text-white text-[11px]">{payload.family.rule.name}</span>
                <VerificationPill status={payload.family.rule.verificationStatus} />
              </>
            ) : (
              <span className="text-gray-500 text-[11px]">Unresolved · legacy compiler defaults</span>
            )}
            <SourceBadge source={payload.family.source} />
          </div>
          {payload.family.status === "resolved" && payload.family.rule && (
            <ul className="ml-3 space-y-0.5 mt-1">
              <FamilyField label="Toe height"    valueMm={payload.family.rule.toeHeightMm} />
              <FamilyField label="Toe recess"    valueMm={payload.family.rule.toeRecessMm} />
              <FamilyField label="Top reveal"    valueMm={payload.family.rule.topRevealMm} />
              <FamilyField label="Bottom reveal" valueMm={payload.family.rule.bottomRevealMm} />
              <FamilyField label="Top scribe"    valueMm={payload.family.rule.topScribeMm} />
              <FamilyField label="Bottom scribe" valueMm={payload.family.rule.bottomScribeMm} />
            </ul>
          )}
        </EffectiveRow>
        <div className="mt-1">
          <AssignmentPicker
            value={familySelectValue}
            onChange={onFamilyChange}
            disabled={!canAssign || saving}
            options={familyOptions}
            disableOption={{ value: DISABLE_FAMILY, label: "Disable standard family rule" }}
          />
          {familyOptions.length === 0 && cabinetType && (
            <p className="text-[10px] text-gray-600 mt-1">
              No family rules exist for cabinetType={cabinetTypeLabel(cabinetType)}. Create one in Settings → Cabinet Systems.
            </p>
          )}
        </div>
      </div>

      {/* ── Front System ────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Front System</p>
        <EffectiveRow>
          <div className="flex items-center gap-1.5 flex-wrap">
            {payload.front.status === "resolved" && payload.front.system ? (
              <>
                <span className="text-white text-[11px]">{payload.front.system.name}</span>
                <span className="text-gray-500 text-[10px]">
                  {payload.front.system.kind} · {payload.front.system.role}
                  {payload.front.system.glassFlag ? " · glass" : ""}
                </span>
                <VerificationPill status={payload.front.system.verificationStatus} />
              </>
            ) : (
              <span className="text-gray-500 text-[11px]">Unresolved</span>
            )}
            <SourceBadge source={payload.front.source} />
          </div>
        </EffectiveRow>
        <div className="mt-1">
          <AssignmentPicker
            value={storedFrontId ?? ""}
            onChange={onFrontChange}
            disabled={!canAssign || saving}
            options={(frontSystems ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} · ${s.kind}`,
            }))}
          />
        </div>
      </div>

      {/* ── Drawer System ───────────────────────────────────────── */}
      {showDrawer && (
        <div className="mb-3">
          <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Drawer System</p>
          <EffectiveRow>
            <div className="flex items-center gap-1.5 flex-wrap">
              {payload.drawer.status === "resolved" && payload.drawer.system ? (
                <>
                  <span className="text-white text-[11px]">{payload.drawer.system.name}</span>
                  <span className="text-gray-500 text-[10px]">
                    {payload.drawer.system.kind}
                    {payload.drawer.system.proprietaryFamily
                      ? ` · ${payload.drawer.system.proprietaryFamily}`
                      : ""}
                  </span>
                  <VerificationPill status={payload.drawer.system.verificationStatus} />
                </>
              ) : (
                <span className="text-gray-500 text-[11px]">Unresolved</span>
              )}
              <SourceBadge source={payload.drawer.source} />
            </div>
            {payload.drawer.status === "resolved" && payload.drawer.system?.kind === "traditional" && (
              <ul className="ml-3 space-y-0.5 mt-1">
                <FamilyField label="Side thk"      valueMm={payload.drawer.system.boxSideThicknessMm} />
                <FamilyField label="Bottom thk"    valueMm={payload.drawer.system.boxBottomThicknessMm} />
                <FamilyField label="Back thk"      valueMm={payload.drawer.system.boxBackThicknessMm} />
                <FamilyField label="Sub-front thk" valueMm={payload.drawer.system.boxSubFrontThicknessMm} />
                {payload.drawer.system.boxJoinery && (
                  <Field label="Joinery">{payload.drawer.system.boxJoinery}</Field>
                )}
              </ul>
            )}
          </EffectiveRow>
          <div className="mt-1">
            <AssignmentPicker
              value={storedDrawerId ?? ""}
              onChange={onDrawerChange}
              disabled={!canAssign || saving}
              options={(drawerSystems ?? []).map((s) => ({
                value: s.id,
                label:
                  s.kind === "proprietary"
                    ? `${s.name} · ${s.proprietaryFamily ?? "proprietary"}`
                    : `${s.name} · traditional`,
              }))}
            />
          </div>
        </div>
      )}

      {/* ── Semantic hardware (read-only) ───────────────────────── */}
      <div className="mb-2">
        <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Semantic Hardware</p>
        {payload.hardware.deferred ? (
          <p className="text-[11px] text-gray-500">
            Hardware resolution deferred — {payload.hardware.deferReason ?? "unresolved"}.
          </p>
        ) : payload.hardware.requirements.length === 0 ? (
          <p className="text-[11px] text-gray-600">No requirements resolved.</p>
        ) : (
          <ul className="space-y-0.5">
            {payload.hardware.requirements.map((r, i) => (
              <li key={i} className="text-[11px] flex items-center gap-1.5">
                <span className="text-white tabular-nums">
                  {r.quantity} {r.unit}
                </span>
                <span className="text-gray-300">
                  {r.category}
                  {typeof r.spec.unmodeledCategory === "string" ? ` (${r.spec.unmodeledCategory})` : ""}
                </span>
                {r.familyHint && <span className="text-gray-600 text-[10px]">· {r.familyHint}</span>}
                {r.requirements.softClose && (
                  <span className="text-gray-600 text-[10px]">· soft-close</span>
                )}
                {r.quantityStatus === "unresolved" && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                    style={{ background: "rgba(200,133,42,0.12)", border: "1px solid #6a5828", color: "#c8852a" }}
                  >
                    Unresolved
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Save error ──────────────────────────────────────────── */}
      {saveError && (
        <div
          className="mt-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{ background: "rgba(200,60,60,0.08)", border: "1px solid #6a2828", color: "#e07070" }}
        >
          {saveError}
        </div>
      )}

      {/* ── Readiness ───────────────────────────────────────────── */}
      {payload.readiness.length > 0 && (
        <div
          className="mt-3 rounded-md px-2 py-1.5"
          style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828" }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#c8852a" }}>
            Systems readiness ({payload.readiness.length})
          </p>
          <ul className="space-y-0.5">
            {payload.readiness.slice(0, 8).map((w, i) => (
              <li key={i} className="text-[11px]" style={{ color: "#c8852a" }}>
                ⚠ [{w.code}] {w.detail}
              </li>
            ))}
            {payload.readiness.length > 8 && (
              <li className="text-[10px] text-gray-500">
                …and {payload.readiness.length - 8} more.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────

function EffectiveRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md p-2 mb-1"
      style={{ background: "#151920", border: "1px solid #22262E" }}
    >
      {children}
    </div>
  );
}

function FamilyField({ label, valueMm }: { label: string; valueMm: number | null }) {
  if (valueMm === null) return null;
  return (
    <li className="text-[11px] flex items-center gap-1.5">
      <span className="text-gray-500 min-w-[110px]">{label}</span>
      <span className="text-white tabular-nums">{valueMm} mm</span>
    </li>
  );
}

function readInt(params: Record<string, unknown> | null | undefined, key: string): number {
  if (!params) return 0;
  const v = params[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
