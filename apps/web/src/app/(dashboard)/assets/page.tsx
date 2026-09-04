"use client";

import { useMemo, useState } from "react";
import {
  SCENE_ASSET_CATEGORIES,
  SCENE_ASSET_CATEGORY_LABELS,
  type SceneAssetCategory,
  type SceneAssetDefinitionRecord,
} from "@woodcraft/shared";
import { resolveSceneAssetThumbnailUrl } from "@/lib/scene/resolveSceneAssetUrl";
import {
  archiveSceneAssetDefinition,
  useSceneAssetDefinitions,
} from "@/hooks/useSceneAssetDefinitions";
import { AddAssetModal } from "./AddAssetModal";

// Asset Library — organization-wide Scene Asset catalog management.
//
// Renders the SAME data the room catalog panel consumes. Adding an
// asset here immediately becomes available in every room's catalog for
// the current organization (org-scoped) or every org (system-scoped,
// platform admin only).

type ScopeFilter = "all" | "system" | "org";
type StatusFilter = "active" | "archived";

export default function AssetLibraryPage() {
  // Admin overview manages its own active/archived toggle via refetch —
  // opt out of renderMode so the initial fetch respects that toggle
  // (`active=true` by default) instead of pulling archived rows too.
  const { loading, error, records, refetch } = useSceneAssetDefinitions({
    renderMode: false,
  });
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<SceneAssetCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Refetch when scope/status changes so the archived filter hits the
  // server (not just a client filter — server enforces the tenancy rule).
  const handleScope = (s: ScopeFilter) => {
    setScope(s);
    void refetch({ scope: s, active: status === "active" ? "true" : "false" });
  };
  const handleStatus = (s: StatusFilter) => {
    setStatus(s);
    void refetch({ scope, active: s === "active" ? "true" : "false" });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (q.length === 0) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.manufacturer ?? "").toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [records, categoryFilter, query]);

  const handleArchive = async (r: SceneAssetDefinitionRecord) => {
    if (archivingId) return;
    if (!window.confirm(`Archive "${r.name}"? Existing rooms using it stay renderable.`)) return;
    setArchivingId(r.id);
    try {
      await archiveSceneAssetDefinition(r.id);
      await refetch({ scope, active: status === "active" ? "true" : "false" });
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="min-h-full p-6 bg-[#0b0d10] text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Asset Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            3D scene assets available to your organization + the CabinetFlow library.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          + Add Asset
        </button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name / manufacturer / SKU / tag"
          className="flex-1 min-w-[240px] bg-surface-100 border border-surface-300 rounded-md px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <SegmentedControl
          value={scope}
          onChange={handleScope}
          options={[
            { value: "all", label: "All" },
            { value: "system", label: "CabinetFlow library" },
            { value: "org", label: "My organization" },
          ]}
        />
        <SegmentedControl
          value={status}
          onChange={handleStatus}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ]}
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <CategoryChip
          label="All"
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        {SCENE_ASSET_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={SCENE_ASSET_CATEGORY_LABELS[c]}
            active={categoryFilter === c}
            onClick={() => setCategoryFilter(c)}
          />
        ))}
      </div>

      {/* Error/loading */}
      {error && (
        <div
          className="mb-4 rounded-md px-3 py-2 text-xs"
          style={{
            background: "rgba(220, 60, 60, 0.10)",
            border: "1px solid #6a2828",
            color: "#e07070",
          }}
        >
          {error}
        </div>
      )}
      {loading && <p className="text-xs text-gray-500 mb-4">Loading…</p>}

      {/* Grid */}
      {filtered.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-gray-400">No assets match.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 text-xs text-brand-400 hover:text-brand-300"
          >
            Upload your first asset →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {filtered.map((r) => (
            <AssetCard
              key={r.id}
              record={r}
              onArchive={() => void handleArchive(r)}
              archiving={archivingId === r.id}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddAssetModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void refetch({ scope, active: status === "active" ? "true" : "false" });
          }}
        />
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="flex items-center rounded-md overflow-hidden"
      style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="text-[11px] px-3 py-1.5 transition-colors"
            style={{
              background: active ? "#c8852a" : "transparent",
              color: active ? "#fff" : "#9A9288",
              fontWeight: active ? 600 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-0.5 text-[11px] transition-colors"
      style={{
        background: active ? "#c8852a" : "#1A1E26",
        border: active ? "1px solid #c8852a" : "1px solid #2E3240",
        color: active ? "#fff" : "#9A9288",
      }}
    >
      {label}
    </button>
  );
}

function AssetCard({
  record,
  onArchive,
  archiving,
}: {
  record: SceneAssetDefinitionRecord;
  onArchive: () => void;
  archiving: boolean;
}) {
  const thumbnailUrl = resolveSceneAssetThumbnailUrl(record.thumbnailKey);
  return (
    <div
      className="rounded-md overflow-hidden flex flex-col"
      style={{ background: "#141519", border: "1px solid #2E3240" }}
    >
      <div
        className="w-full aspect-video flex items-center justify-center"
        style={{ background: "#0f1114" }}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="text-3xl" style={{ color: "#c8852a" }} aria-hidden>
            {record.model ? "◈" : "▢"}
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm text-white font-medium truncate">{record.name}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 truncate">
          {SCENE_ASSET_CATEGORY_LABELS[record.category as SceneAssetCategory] ?? record.category}
          {" · "}
          v{record.revision}
        </p>
        <p className="text-[10px] text-gray-500 tabular-nums mt-1">
          {Math.round(record.widthMm)} × {Math.round(record.heightMm)} × {Math.round(record.depthMm)} mm
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <ScopeBadge scope={record.scope} systemManaged={record.systemManaged} />
          {record.model ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
              style={{ background: "rgba(60,160,60,0.10)", border: "1px solid #1f4a1f", color: "#7fbf7f" }}
            >
              GLB
            </span>
          ) : (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
              style={{ background: "rgba(90,90,100,0.15)", border: "1px solid #2E3240", color: "#8a8080" }}
            >
              Primitive
            </span>
          )}
          {!record.active && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
              style={{ background: "rgba(200,133,42,0.12)", border: "1px solid #6a5828", color: "#c8852a" }}
            >
              Archived
            </span>
          )}
        </div>
        {(record.manufacturer || record.sku) && (
          <p className="text-[10px] text-gray-600 mt-2 truncate">
            {[record.manufacturer, record.sku].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex-1" />
        {record.active && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={onArchive}
              disabled={archiving}
              className="text-[11px] text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              {archiving ? "Archiving…" : "Archive"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeBadge({
  scope,
  systemManaged,
}: {
  scope: "system" | "org";
  systemManaged: boolean;
}) {
  const isSystem = scope === "system";
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
      style={{
        background: isSystem ? "rgba(90,120,200,0.10)" : "rgba(200,133,42,0.10)",
        border: isSystem ? "1px solid #2a3d6a" : "1px solid #6a5828",
        color: isSystem ? "#8fa0d0" : "#c8852a",
      }}
      title={systemManaged ? "System-managed (CabinetFlow curated)" : undefined}
    >
      {isSystem ? "System" : "Org"}
    </span>
  );
}
