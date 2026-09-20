"use client";

// Shared UI primitives for the Phase 2/2.1 Cabinet Systems surfaces.
// Kept in one file to match the existing "flat components" convention
// in this repo (no `components/ui/` prefab library).

import type { ReactNode } from "react";

// ─── CabinetType human labels ─────────────────────────────────────────

export const CABINET_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  wall: "Wall",
  tall: "Tall",
  corner: "Corner",
  drawer_base: "Drawer Base",
  sink_base: "Sink Base",
  island: "Island",
};

export const CABINET_TYPES = [
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
] as const;

export type CabinetType = (typeof CABINET_TYPES)[number];

export function cabinetTypeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  return CABINET_TYPE_LABELS[t] ?? t;
}

// ─── Source labels + badge ────────────────────────────────────────────

export type SystemSource =
  | "cabinet"
  | "room"
  | "project"
  | "organization"
  | "cabinet_disabled"
  | "none";

const SOURCE_LABELS: Record<SystemSource, string> = {
  cabinet: "Cabinet Override",
  room: "Room",
  project: "Project",
  organization: "Organization",
  cabinet_disabled: "Disabled · Cabinet",
  none: "Unresolved",
};

export function sourceLabel(s: SystemSource | null | undefined): string {
  return SOURCE_LABELS[s ?? "none"];
}

/** Neutral source badge. Never uses a warning color for normal inherited
 *  state — that would misread as an error. Unresolved gets an amber tint;
 *  disabled a slate tint; everything else a subtle gray. */
export function SourceBadge({ source }: { source: SystemSource | null | undefined }) {
  const s = source ?? "none";
  const cfg =
    s === "none"
      ? { bg: "rgba(200,133,42,0.10)", border: "#6a5828", fg: "#c8852a" }
      : s === "cabinet_disabled"
        ? { bg: "rgba(120,130,150,0.10)", border: "#3a4050", fg: "#8b96a8" }
        : { bg: "rgba(120,130,150,0.08)", border: "#2E3240", fg: "#a0acbf" };
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.fg }}
    >
      {SOURCE_LABELS[s]}
    </span>
  );
}

// ─── Verification pill ───────────────────────────────────────────────

export function VerificationPill({ status }: { status: string | null | undefined }) {
  const s = status ?? "unverified";
  const cfg =
    s === "verified"
      ? { bg: "rgba(60,160,60,0.10)", border: "#1f4a1f", fg: "#7fbf7f", label: "Verified" }
      : s === "partially_verified"
        ? { bg: "rgba(200,133,42,0.12)", border: "#6a5828", fg: "#c8852a", label: "Partial" }
        : s === "project_specific"
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

// ─── Assignment-picker primitive ──────────────────────────────────────

export interface AssignmentPickerOption {
  value: string;
  label: string;
  hint?: string;   // secondary line rendered as small gray text
}

interface AssignmentPickerProps {
  value: string;                  // "" = inherit, "__disable__" = disable family, else id
  onChange: (next: string) => void;
  disabled?: boolean;
  options: AssignmentPickerOption[];
  includeInherit?: boolean;       // default true — "Inherit" first
  disableOption?: {               // optional third option, e.g. family-disable
    value: string;
    label: string;
  };
  placeholder?: string;
}

export function AssignmentPicker({
  value,
  onChange,
  disabled,
  options,
  includeInherit = true,
  disableOption,
  placeholder,
}: AssignmentPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-xs rounded-md px-2 py-1.5 text-white"
      style={{
        background: "#1A1E26",
        border: "1px solid #2E3240",
        colorScheme: "dark",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {includeInherit && !placeholder && <option value="">Inherit</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {disableOption && (
        <option value={disableOption.value}>{disableOption.label}</option>
      )}
    </select>
  );
}

// ─── Row helpers ─────────────────────────────────────────────────────

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-[11px] flex items-center gap-1.5">
      <span className="text-gray-500 min-w-[110px]">{label}</span>
      <span className="text-white tabular-nums">{children}</span>
    </div>
  );
}
