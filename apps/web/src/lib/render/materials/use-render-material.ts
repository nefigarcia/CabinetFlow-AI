"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { MaterialSlot, MaterialSelection } from "@woodcraft/shared";
import { resolveSlotMaterial } from "@woodcraft/shared";
import { buildThreeMaterial } from "./material-factory";
import type { FaceSizeMm } from "./uv-utils";

export interface UseRenderMaterialOptions {
  /** Face size in mm — drives UV `repeat`. */
  face?: FaceSizeMm;
  /** Force transparency (e.g. glass front). Defaults to profile opacity. */
  opacityOverride?: number;
  /** Highlight tint added as emissive (used for selection). */
  emissiveHex?: string;
  emissiveIntensity?: number;
}

/**
 * React hook that resolves a MaterialSlot for a cabinet through the
 * shared resolver and returns a memoized THREE.MeshStandardMaterial.
 *
 * The hook is safe to call from any mesh — the underlying factory
 * caches materials by (profileId, face size, opacity). Selection
 * highlight is applied via emissive tint rather than by swapping the
 * underlying material, so cache stays warm.
 */
export function useSlotMaterial(
  selection: MaterialSelection,
  cabinetId: string | null,
  slot: MaterialSlot,
  opts: UseRenderMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const {
    face,
    opacityOverride,
    emissiveHex,
    emissiveIntensity = 0,
  } = opts;

  return useMemo(() => {
    const { profile } = resolveSlotMaterial(selection, cabinetId, slot);
    const base = buildThreeMaterial(profile, { face, opacityOverride });

    // If the caller wants a highlight tint, clone the cached material so we
    // don't leak selection state across meshes. Base materials remain shared.
    if (emissiveHex && emissiveIntensity > 0) {
      const clone = base.clone();
      clone.emissive = new THREE.Color(emissiveHex);
      clone.emissiveIntensity = emissiveIntensity;
      return clone;
    }
    return base;
  }, [
    selection,
    cabinetId,
    slot,
    face?.widthMm,
    face?.heightMm,
    opacityOverride,
    emissiveHex,
    emissiveIntensity,
  ]);
}
