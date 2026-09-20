"use client";

// Effective Profile section for the CabinetInspector — displays the
// merged construction / material / hardware profile for a specific
// cabinet, per-field value + source + verification pill. Non-blocking
// readiness warnings render below.
//
// Fetches from /api/projects/{id}/rooms/{roomId}/cabinets/{cabinetId}/effective-profile.

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type ProfileSource = "organization" | "project" | "room" | "cabinet";

interface FieldVerificationEntry {
  status: "verified" | "project_specific" | "unverified" | "unknown";
  profileSource?: ProfileSource;
  sourceRef?: string | null;
}

interface KindBundle {
  effective: Record<string, unknown>;
  fieldSources: Record<string, ProfileSource>;
  profileIds: Partial<Record<ProfileSource, string>>;
  fieldVerification: Record<string, FieldVerificationEntry>;
}

interface EffectiveProfilePayload {
  construction: KindBundle;
  material:     KindBundle;
  hardware:     KindBundle;
  gaps: { open: string[]; resolved: string[] };
  deferredCapabilities: Array<{
    scope: ProfileSource;
    kind: "construction" | "material" | "hardware";
    capability: { capability: string; status: string; sourceRef: string; value?: unknown; facts?: Record<string, unknown> };
  }>;
  readiness: Array<{
    code: string;
    severity: "warning";
    scope: ProfileSource;
    kind?: "construction" | "material" | "hardware";
    detail: string;
    sourceRef?: string | null;
  }>;
}

// Human-friendly labels for canonical fields.
const FIELD_LABELS: Record<string, string> = {
  constructionMethod:          "Construction",
  frontOverlayMode:            "Front overlay",
  carcassThicknessMm:          "Carcass thickness",
  drawerBoxThicknessMm:        "Drawer box thickness",
  drawerBoxJoinery:            "Drawer box joinery",
  backThicknessMm:             "Back thickness",
  adjustableShelfThicknessMm:  "Adj. shelf thickness",
  nailerThicknessMm:           "Nailer thickness",

  carcassMaterialSpec:          "Carcass material",
  drawerBoxMaterialSpec:        "Drawer box material",
  faceFrameMaterialSpec:        "Face frame material",
  doorMaterialSpec:             "Door material",
  shelfMaterialSpec:            "Shelf material",
  backMaterialSpec:             "Back material",
  adjustableShelfMaterialSpec:  "Adj. shelf material",
  nailerMaterialSpec:           "Nailer material",

  hingeManufacturer:       "Hinge mfr",
  hingeSoftClose:          "Hinge soft-close",
  hingeSystem:             "Hinge system",
  drawerSlideManufacturer: "Drawer slide mfr",
  drawerSlideSoftClose:    "Drawer slide soft-close",
  drawerSlideSystem:       "Drawer slide system",
};

const SCOPE_LABELS: Record<ProfileSource, string> = {
  organization: "Organization",
  project:      "Project",
  room:         "Room",
  cabinet:      "Cabinet",
};

interface Props {
  projectId: string;
  roomId: string;
  cabinetId: string;
}

export function EffectiveProfileSection({ projectId, roomId, cabinetId }: Props) {
  const [payload, setPayload] = useState<EffectiveProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<EffectiveProfilePayload>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-profile`,
      )
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message ?? "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, roomId, cabinetId]);

  if (loading) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Effective Profile</p>
        <p className="text-gray-500 text-xs">Loading…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Effective Profile</p>
        <p className="text-red-400 text-xs">{error}</p>
      </section>
    );
  }
  if (!payload) return null;

  return (
    <section>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Effective Profile</p>

      <KindBlock label="Construction" bundle={payload.construction} />
      <KindBlock label="Material"     bundle={payload.material} />
      <KindBlock label="Hardware"     bundle={payload.hardware} />

      {payload.deferredCapabilities.length > 0 && (
        <div className="mt-3">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">
            Verified rules — typed support deferred
          </p>
          <ul className="space-y-0.5">
            {payload.deferredCapabilities.map((d, i) => (
              <li key={i} className="text-[11px] text-gray-400">
                <span className="text-gray-300">{d.capability.capability}</span>
                {typeof d.capability.value === "string" && (
                  <span className="text-gray-500"> · {d.capability.value}</span>
                )}
                {" — "}
                <span className="text-gray-500">{SCOPE_LABELS[d.scope]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {payload.readiness.length > 0 && (
        <div className="mt-3 rounded-md px-2 py-1.5" style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828" }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#c8852a" }}>
            Readiness ({payload.readiness.length})
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

function KindBlock({ label, bundle }: { label: string; bundle: KindBundle }) {
  const fieldKeys = Object.keys(bundle.effective);
  const fieldsWithValue = fieldKeys.filter((f) => bundle.effective[f] !== null);
  if (fieldsWithValue.length === 0) {
    return (
      <div className="mb-2">
        <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">{label}</p>
        <p className="text-[11px] text-gray-600">No values resolved — using legacy compiler defaults.</p>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      <ul className="space-y-0.5">
        {fieldsWithValue.map((f) => {
          const value = bundle.effective[f];
          const verif = bundle.fieldVerification[f];
          const source = bundle.fieldSources[f];
          return (
            <li key={f} className="text-[11px] flex items-center gap-1.5">
              <span className="text-gray-500 min-w-[110px]">{FIELD_LABELS[f] ?? f}</span>
              <span className="text-white tabular-nums">{formatValue(value)}</span>
              {verif && verif.status !== "unknown" && (
                <VerificationPill status={verif.status} />
              )}
              {source && (
                <span className="text-gray-600 text-[10px]">
                  · {SCOPE_LABELS[source]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {fieldKeys.length > fieldsWithValue.length && (
        <p className="text-[10px] text-gray-600 mt-1">
          {fieldKeys.length - fieldsWithValue.length} field(s) unresolved — legacy default in use.
        </p>
      )}
    </div>
  );
}

function VerificationPill({ status }: { status: "verified" | "project_specific" | "unverified" }) {
  const cfg =
    status === "verified"
      ? { bg: "rgba(60,160,60,0.10)", border: "#1f4a1f", fg: "#7fbf7f", label: "Verified" }
      : status === "project_specific"
        ? { bg: "rgba(200,133,42,0.12)", border: "#6a5828", fg: "#c8852a", label: "Project" }
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return `${value}`;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}
