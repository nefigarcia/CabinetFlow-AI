import * as THREE from "three";
import type { MaterialRenderProfile } from "@woodcraft/shared";
import { CATEGORY_DEFAULT_SCALE_MM } from "@woodcraft/shared";
import { loadTexture, peekTexture } from "./texture-cache";
import { computeRepeat, type FaceSizeMm } from "./uv-utils";

// Reusable factory that turns a MaterialRenderProfile into a
// THREE.MeshStandardMaterial. Materials are cached per (profileId, faceKey)
// so panning the same door across many cabinets does not multiply
// material allocations.

interface MaterialBuildOptions {
  /** Face size in mm for correct UV repeat. Missing → 1:1 tiling. */
  face?: FaceSizeMm;
  /** Overrides `profile.opacity` when the mesh needs to be transparent
   *  regardless of profile (e.g. selection highlight, glass case). */
  opacityOverride?: number;
}

interface CacheKey {
  profileId: string;
  profileVersion: number;
  faceW: number;
  faceH: number;
  opacityOverride: number;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function keyOf(k: CacheKey): string {
  return `${k.profileId}#${k.profileVersion}#${k.faceW}x${k.faceH}#${k.opacityOverride}`;
}

function effectiveScale(profile: MaterialRenderProfile): number {
  if (profile.scaleMm !== undefined) return profile.scaleMm;
  return CATEGORY_DEFAULT_SCALE_MM[profile.category];
}

/**
 * Build (or reuse) a MeshStandardMaterial for a profile + face size.
 *
 * If the profile has texture URLs, the returned material has its color
 * map attached synchronously if the texture was already loaded; otherwise
 * the load starts and the map is attached (with correct repeat) when the
 * texture resolves. First-frame appearance falls back to `baseColorHex`.
 */
export function buildThreeMaterial(
  profile: MaterialRenderProfile,
  options: MaterialBuildOptions = {},
): THREE.MeshStandardMaterial {
  const face: FaceSizeMm = options.face ?? { widthMm: 1000, heightMm: 1000 };
  const opacityOverride = options.opacityOverride ?? profile.opacity ?? 1;

  const key = keyOf({
    profileId: profile.id,
    profileVersion: profile.version,
    faceW: Math.round(face.widthMm),
    faceH: Math.round(face.heightMm),
    opacityOverride,
  });

  const cached = materialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(profile.baseColorHex),
    roughness: profile.roughness,
    metalness: profile.metalness,
    transparent: opacityOverride < 1,
    opacity: opacityOverride,
  });

  const scale = effectiveScale(profile);
  const repeat = computeRepeat(face, scale, profile.grainDirection);

  attachTextures(material, profile, repeat);

  materialCache.set(key, material);
  return material;
}

function attachTextures(
  material: THREE.MeshStandardMaterial,
  profile: MaterialRenderProfile,
  repeat: { u: number; v: number },
): void {
  const t = profile.textures;
  if (!t) return;

  if (t.albedoUrl) attachMap(material, "map", t.albedoUrl, "albedo", repeat);
  if (t.normalUrl) attachMap(material, "normalMap", t.normalUrl, "normal", repeat);
  if (t.roughnessUrl) attachMap(material, "roughnessMap", t.roughnessUrl, "roughness", repeat);
  if (t.metalnessUrl) attachMap(material, "metalnessMap", t.metalnessUrl, "metalness", repeat);
  if (t.aoUrl) attachMap(material, "aoMap", t.aoUrl, "ao", repeat);
}

function attachMap(
  material: THREE.MeshStandardMaterial,
  slot: "map" | "normalMap" | "roughnessMap" | "metalnessMap" | "aoMap",
  url: string,
  role: "albedo" | "normal" | "roughness" | "metalness" | "ao",
  repeat: { u: number; v: number },
): void {
  const already = peekTexture(url);
  if (already && already.image) {
    (material as unknown as Record<string, THREE.Texture | null>)[slot] = already;
    already.repeat.set(repeat.u, repeat.v);
    material.needsUpdate = true;
    return;
  }

  void loadTexture(url, role)
    .then((tex) => {
      // Clone the texture so different repeats don't collide across
      // materials sharing the underlying image.
      const local = tex.clone();
      local.needsUpdate = true;
      local.repeat.set(repeat.u, repeat.v);
      (material as unknown as Record<string, THREE.Texture | null>)[slot] = local;
      material.needsUpdate = true;
    })
    .catch(() => {
      // Silent failure: material still renders with baseColor.
    });
}

/** For tests: reset the material cache. Not for production use. */
export function __resetMaterialCacheForTests(): void {
  materialCache.forEach((m) => m.dispose());
  materialCache.clear();
}

/** Diagnostic: current number of cached materials. */
export function materialCacheSize(): number {
  return materialCache.size;
}
