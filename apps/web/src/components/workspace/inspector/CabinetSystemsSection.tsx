"use client";

// Cabinet Systems section for the CabinetInspector (Phase 2). Renders
// the resolved family rule + front + drawer system + semantic hardware
// requirements + Phase 2 readiness warnings. Metadata + readiness only
// — nothing here triggers CAD or BOM.
//
// Fetches from /api/projects/{id}/rooms/{roomId}/cabinets/{cabinetId}/effective-systems.

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type Scope = "cabinet" | "room" | "project" | "organization";
type FamilySource = Scope | "cabinet_disabled" | "none";
type FamilyStatus = "resolved" | "unresolved" | "disabled";
type SystemStatus = "resolved" | "unresolved";
type SystemSource = Scope | "none";

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
  family: { rule: FamilyRule | null; status: FamilyStatus; source: FamilySource };
  front:  { system: FrontSystem | null;  status: SystemStatus; source: SystemSource };
  drawer: { system: DrawerSystem | null; status: SystemStatus; source: SystemSource };
  hardware: {
    requirements: HardwareRequirement[];
    deferred: boolean;
    deferReason?: string;
  };
  readiness: Array<{ code: string; severity: "warning"; detail: string }>;
}

const SCOPE_LABELS: Record<Scope, string> = {
  cabinet:      "Cabinet",
  room:         "Room",
  project:      "Project",
  organization: "Organization",
};

interface Props {
  projectId: string;
  roomId: string;
  cabinetId: string;
}

export function CabinetSystemsSection({ projectId, roomId, cabinetId }: Props) {
  const [payload, setPayload] = useState<EffectiveSystemsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<EffectiveSystemsPayload>(
        `/projects/${projectId}/rooms/${roomId}/cabinets/${cabinetId}/effective-systems`,
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
  if (!payload) return null;

  return (
    <section>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cabinet Systems</p>

      <FamilyBlock family={payload.family} />
      <FrontBlock front={payload.front} />
      <DrawerBlock drawer={payload.drawer} />
      <HardwareBlock hardware={payload.hardware} />

      {payload.readiness.length > 0 && (
        <div className="mt-3 rounded-md px-2 py-1.5" style={{ background: "rgba(200,133,42,0.08)", border: "1px solid #6a5828" }}>
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

function FamilyBlock({ family }: { family: EffectiveSystemsPayload["family"] }) {
  return (
    <div className="mb-3">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Family Rule</p>
      {family.status === "disabled" ? (
        <div className="text-[11px]">
          <span className="text-gray-300">Standard rule disabled</span>
          <span className="text-gray-500"> · Cabinet override · intentional</span>
        </div>
      ) : family.status === "resolved" && family.rule ? (
        <div className="text-[11px] space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-white">{family.rule.name}</span>
            <VerificationPill status={family.rule.verificationStatus} />
            <span className="text-gray-600 text-[10px]">
              · {SCOPE_LABELS[family.source as Scope]}
            </span>
          </div>
          <ul className="ml-3 space-y-0.5">
            <FamilyField label="Toe height"    valueMm={family.rule.toeHeightMm} />
            <FamilyField label="Toe recess"    valueMm={family.rule.toeRecessMm} />
            <FamilyField label="Top reveal"    valueMm={family.rule.topRevealMm} />
            <FamilyField label="Bottom reveal" valueMm={family.rule.bottomRevealMm} />
            <FamilyField label="Top scribe"    valueMm={family.rule.topScribeMm} />
            <FamilyField label="Bottom scribe" valueMm={family.rule.bottomScribeMm} />
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">
          No family rule resolved — legacy compiler behavior in use.
        </p>
      )}
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

function FrontBlock({ front }: { front: EffectiveSystemsPayload["front"] }) {
  return (
    <div className="mb-3">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Front System</p>
      {front.status === "resolved" && front.system ? (
        <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
          <span className="text-white">{front.system.name}</span>
          <span className="text-gray-500 text-[10px]">
            {front.system.kind} · {front.system.role}
            {front.system.glassFlag ? " · glass" : ""}
          </span>
          <VerificationPill status={front.system.verificationStatus} />
          <span className="text-gray-600 text-[10px]">
            · {SCOPE_LABELS[front.source as Scope]}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">
          No front system resolved.
        </p>
      )}
    </div>
  );
}

function DrawerBlock({ drawer }: { drawer: EffectiveSystemsPayload["drawer"] }) {
  return (
    <div className="mb-3">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Drawer System</p>
      {drawer.status === "resolved" && drawer.system ? (
        <div className="text-[11px] space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white">{drawer.system.name}</span>
            <span className="text-gray-500 text-[10px]">
              {drawer.system.kind}
              {drawer.system.proprietaryFamily ? ` · ${drawer.system.proprietaryFamily}` : ""}
            </span>
            <VerificationPill status={drawer.system.verificationStatus} />
            <span className="text-gray-600 text-[10px]">
              · {SCOPE_LABELS[drawer.source as Scope]}
            </span>
          </div>
          {drawer.system.kind === "traditional" && (
            <ul className="ml-3 space-y-0.5">
              <FamilyField label="Side thk"      valueMm={drawer.system.boxSideThicknessMm} />
              <FamilyField label="Bottom thk"    valueMm={drawer.system.boxBottomThicknessMm} />
              <FamilyField label="Back thk"      valueMm={drawer.system.boxBackThicknessMm} />
              <FamilyField label="Sub-front thk" valueMm={drawer.system.boxSubFrontThicknessMm} />
              {drawer.system.boxJoinery && (
                <li className="text-[11px] flex items-center gap-1.5">
                  <span className="text-gray-500 min-w-[110px]">Joinery</span>
                  <span className="text-white">{drawer.system.boxJoinery}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">
          No drawer system resolved.
        </p>
      )}
    </div>
  );
}

function HardwareBlock({ hardware }: { hardware: EffectiveSystemsPayload["hardware"] }) {
  return (
    <div className="mb-2">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Semantic Hardware</p>
      {hardware.deferred ? (
        <p className="text-[11px] text-gray-500">
          Hardware resolution deferred — {hardware.deferReason ?? "unresolved"}.
        </p>
      ) : hardware.requirements.length === 0 ? (
        <p className="text-[11px] text-gray-600">No requirements resolved.</p>
      ) : (
        <ul className="space-y-0.5">
          {hardware.requirements.map((r, i) => (
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
                <span className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                  style={{ background: "rgba(200,133,42,0.12)", border: "1px solid #6a5828", color: "#c8852a" }}>
                  Unresolved
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerificationPill({ status }: { status: string }) {
  const cfg =
    status === "verified"
      ? { bg: "rgba(60,160,60,0.10)", border: "#1f4a1f", fg: "#7fbf7f", label: "Verified" }
      : status === "partially_verified"
        ? { bg: "rgba(200,133,42,0.12)", border: "#6a5828", fg: "#c8852a", label: "Partial" }
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
