"use client";

import { useMemo, useState } from "react";
import {
  filterCatalogByCategory,
  filterCatalogForRoomType,
  getDefaultSceneAssetPlacement,
  getRecommendedCategoriesForRoomType,
  getRoomArchitecture,
  getRoomType,
  getWallLengthMm,
  isWallMounted,
  resolveWallAttachedSceneAssetTransform,
  SCENE_ASSET_CATEGORY_LABELS,
  searchCatalog,
  type PlacementWarning,
  type SceneAssetCategory,
  type SceneAssetDefinition,
  type SceneAssetInstancePlacement,
} from "@woodcraft/shared";
import { useEditorStore } from "@/store/editor";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useSceneAssets } from "@/hooks/useSceneAssets";
import { resolveSceneAssetThumbnailUrl } from "@/lib/scene/resolveSceneAssetUrl";

// CatalogPanel — the Scene Asset side of the "Components / Assets" region.
//
// Reads definitions from `useSceneAssetsStore` (single source of truth per
// Slice 2); does NOT keep its own catalog copy. Filtering uses the pure
// shared helpers so recommended-category / search logic is testable.
//
// Placement uses `getDefaultSceneAssetPlacement`, which returns a
// deterministic center-of-floor transform and any oversized-asset warnings.
// The panel surfaces warnings inline; placement is permissive (still
// allowed) — WoodCraft OS custom projects need that flexibility.
//
// Cabinet-side library architecture is intentionally deferred; this panel
// only owns the Scene side. A future slice can add a sibling
// `<CabinetCatalogPanel>` under the same shell without touching this file.

type CategoryFilter = "recommended" | "all" | SceneAssetCategory;

interface Props {
  projectId: string;
}

export function CatalogPanel({ projectId }: Props) {
  const definitions = useSceneAssetsStore((s) => s.definitions);

  const selectedRoomId = useEditorStore((s) => s.selectedRoomId);
  const rooms = useEditorStore((s) => s.rooms);
  const selectSceneAsset = useEditorStore((s) => s.selectSceneAsset);
  const selectedWallId = useEditorStore((s) => s.selectedWallId);

  const { create, saving } = useSceneAssets(projectId);

  const [filter, setFilter] = useState<CategoryFilter>("recommended");
  const [query, setQuery] = useState("");
  const [lastPlacement, setLastPlacement] = useState<{
    definitionName: string;
    warnings: PlacementWarning[];
  } | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);

  const room = rooms.find((r) => r.id === selectedRoomId);
  const roomType = getRoomType(room);
  const recommendedCategories = getRecommendedCategoriesForRoomType(roomType);

  // Category strip: Recommended + All + categories that actually have
  // entries in the loaded catalog. Keeps the strip short and honest.
  const categoriesPresent = useMemo<SceneAssetCategory[]>(() => {
    const present = new Set<SceneAssetCategory>();
    for (const d of definitions) present.add(d.category);
    // Preserve the canonical ordering for stable UI.
    return recommendedCategories
      .filter((c) => present.has(c))
      .concat(
        [...present]
          .filter((c) => !recommendedCategories.includes(c))
          .sort(),
      );
  }, [definitions, recommendedCategories]);

  const filteredByCategory = useMemo<SceneAssetDefinition[]>(() => {
    if (filter === "recommended") {
      return filterCatalogForRoomType(definitions, roomType);
    }
    if (filter === "all") {
      return definitions.slice();
    }
    return filterCatalogByCategory(definitions, filter);
  }, [definitions, filter, roomType]);

  const results = useMemo<SceneAssetDefinition[]>(
    () => searchCatalog(filteredByCategory, query),
    [filteredByCategory, query],
  );

  const canPlace = Boolean(selectedRoomId && room);

  // Click → compute deterministic placement → POST → add server-returned
  // instance to the store → select. Id, timestamps, and tenancy come from
  // the server (Slice 6 persistence). Local-only optimistic add was
  // removed — persistence is the only path now.
  const handlePlace = async (definition: SceneAssetDefinition) => {
    if (!canPlace || !room || placingId) return;

    // Wall-mounted definitions attach at the deterministic center of the
    // currently selected wall (or the first wall in the architecture if
    // none is selected). No fallback to floor-center — placing a sconce
    // on the floor would misrepresent its intent.
    let placementMode: SceneAssetInstancePlacement = { mode: "free" };
    let worldPositionMm = { x: 0, y: 0, z: 0 };
    let worldRotationDeg = { x: 0, y: 0, z: 0 };
    let warnings: PlacementWarning[] = [];

    if (isWallMounted(definition.placement)) {
      const architecture = getRoomArchitecture({
        metadata: room.metadata ?? null,
        width: Number(room.width),
        height: Number(room.height),
        depth: Number(room.depth),
      });
      // Require an EXPLICIT wall selection — never silently pick walls[0].
      // Picking a "first wall" for the user hides the intent question
      // (which wall?) and produces confusingly-placed assets on rooms
      // with more than one exterior wall. Ask instead.
      if (!selectedWallId) {
        setPlacementError(
          `${definition.name} is wall-mounted. Select a wall in the 3D view (or the Architecture tab) first, then click again.`,
        );
        return;
      }
      const targetWall = architecture.walls.find((w) => w.id === selectedWallId);
      if (!targetWall) {
        setPlacementError(
          `${definition.name} is wall-mounted, but the selected wall no longer exists in this room's architecture.`,
        );
        return;
      }
      const wallLength = getWallLengthMm(targetWall);
      const halfHeight = definition.dimensionsMm.heightMm / 2;
      // Center along wall; mid-height above floor as a sensible default
      // (sconces, mirrors, art all sit somewhere in the upper half).
      const anchor = {
        x: wallLength / 2,
        y: Math.max(halfHeight, targetWall.heightMm / 2),
        z: 0,
      };
      placementMode = {
        mode: "wall",
        wall: { wallId: targetWall.id, localPositionMm: anchor },
      };
      const resolved = resolveWallAttachedSceneAssetTransform({
        attachment: placementMode.wall!,
        definition,
        architecture,
      });
      if (resolved) {
        worldPositionMm = resolved.positionMm;
        worldRotationDeg = resolved.rotationDeg;
      }
    } else {
      const defaults = getDefaultSceneAssetPlacement({ room, definition });
      worldPositionMm = defaults.transform.positionMm;
      worldRotationDeg = defaults.transform.rotationDeg;
      warnings = defaults.warnings;
    }

    setPlacingId(definition.id);
    setPlacementError(null);
    try {
      const instance = await create({
        assetDefinitionId: definition.id,
        positionMm: worldPositionMm,
        rotationDeg: worldRotationDeg,
        visible: true,
        placement: placementMode,
      });
      if (instance) {
        selectSceneAsset(instance.id);
        setLastPlacement({
          definitionName: definition.name,
          warnings,
        });
      } else {
        setPlacementError(
          `Couldn't save ${definition.name}. Check your connection and try again.`,
        );
      }
    } finally {
      setPlacingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category filter strip */}
      <div className="px-2 pt-2 pb-1.5 flex flex-wrap gap-1">
        <FilterChip
          label="Recommended"
          active={filter === "recommended"}
          onClick={() => setFilter("recommended")}
        />
        <FilterChip
          label="All"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {categoriesPresent.map((cat) => (
          <FilterChip
            key={cat}
            label={SCENE_ASSET_CATEGORY_LABELS[cat]}
            active={filter === cat}
            onClick={() => setFilter(cat)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="px-2 pb-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets…"
          className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Not-ready notice */}
      {!canPlace && (
        <div
          className="mx-2 mb-1.5 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(150, 120, 60, 0.10)",
            border: "1px solid #4a3d20",
            color: "#c8a86a",
          }}
        >
          Select a room to place assets.
        </div>
      )}

      {/* Persistence error banner */}
      {placementError && (
        <div
          className="mx-2 mb-1.5 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(220, 60, 60, 0.10)",
            border: "1px solid #6a2828",
            color: "#e07070",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">{placementError}</span>
            <button
              onClick={() => setPlacementError(null)}
              className="flex-shrink-0 text-gray-500 hover:text-white text-xs leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Last-placement warnings */}
      {lastPlacement && lastPlacement.warnings.length > 0 && (
        <div
          className="mx-2 mb-1.5 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: "rgba(200, 133, 42, 0.10)",
            border: "1px solid #6a5828",
            color: "#c8852a",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate">
                Placed {lastPlacement.definitionName}, with notes:
              </p>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                {lastPlacement.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setLastPlacement(null)}
              className="flex-shrink-0 text-gray-500 hover:text-white text-xs leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-auto px-2 pb-2 space-y-1">
        {results.length === 0 ? (
          <p className="text-xs text-gray-600 px-1 mt-3">
            {query.trim().length > 0 ? "No assets match your search." : "No assets in this category."}
          </p>
        ) : (
          results.map((definition) => (
            <AssetCard
              key={definition.id}
              definition={definition}
              disabled={!canPlace || saving}
              placing={placingId === definition.id}
              onClick={() => handlePlace(definition)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
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
      className="rounded-full px-2 py-0.5 text-[11px] transition-colors"
      style={{
        background: active ? "#c8852a" : "#1A1E26",
        border: active ? "1px solid #c8852a" : "1px solid #2E3240",
        color: active ? "#fff" : "#9A9288",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "#9A9288";
      }}
    >
      {label}
    </button>
  );
}

/** Category-based glyph. Deliberately not a full thumbnail — those arrive
 *  when licensed GLB assets land (Slice 10). */
const CATEGORY_GLYPH: Record<SceneAssetCategory, string> = {
  appliance: "▢",
  furniture: "◫",
  plumbing: "◊",
  lighting: "◉",
  decor: "◈",
  plant: "❦",
  rug: "▬",
  electronics: "▤",
  fixture: "◇",
};

/** Renders a real thumbnail image when the definition declares one;
 *  otherwise falls back to the category glyph. Never invents a fake
 *  thumbnail — the placeholder makes the difference visible so catalog
 *  authors know when a definition still needs a real image. */
function CatalogCardIcon({ definition }: { definition: SceneAssetDefinition }) {
  const thumbnailUrl = resolveSceneAssetThumbnailUrl(
    definition.model?.thumbnailKey ?? null,
  );

  if (thumbnailUrl) {
    return (
      <span
        className="w-8 h-8 flex-shrink-0 rounded-md overflow-hidden"
        style={{
          background: "#1A1E26",
          border: "1px solid #2E3240",
        }}
      >
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken thumbnails; the glyph will show up as a fallback
            // via the sibling `<span aria-hidden>` if we swap layout later.
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md text-base"
      style={{
        background: "#1A1E26",
        border: "1px solid #2E3240",
        color: "#c8852a",
      }}
    >
      {CATEGORY_GLYPH[definition.category]}
    </span>
  );
}

function AssetCard({
  definition,
  disabled,
  placing,
  onClick,
}: {
  definition: SceneAssetDefinition;
  disabled: boolean;
  placing: boolean;
  onClick: () => void;
}) {
  const { widthMm, heightMm, depthMm } = definition.dimensionsMm;
  const categoryLabel = SCENE_ASSET_CATEGORY_LABELS[definition.category];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-surface-200 text-gray-300 hover:text-white",
      ].join(" ")}
      style={{ background: "transparent" }}
      title={disabled ? "Select a room to place assets" : `Place ${definition.name} in the current room`}
    >
      <CatalogCardIcon definition={definition} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium truncate">
          {definition.name}
          {placing && <span className="ml-1 text-gray-500 text-[10px]">saving…</span>}
        </span>
        <span className="block text-[10px] text-gray-500 tabular-nums">
          {widthMm} × {heightMm} × {depthMm} mm · {categoryLabel}
        </span>
      </span>
    </button>
  );
}
