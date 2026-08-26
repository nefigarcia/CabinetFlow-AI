import * as THREE from "three";

// Texture cache and dedupe-loader.
//
// The Three.js TextureLoader triggers a fresh HTTP request every call, so
// naive per-mesh loading multiplies texture bandwidth by the number of
// meshes. This cache keys textures by URL, hands the same THREE.Texture
// to every caller, and dedupes concurrent loads by promise. Callers must
// NOT call .dispose() on cached textures — the cache owns them.

type TextureKey = string;

interface CacheEntry {
  texture: THREE.Texture;
  loading: Promise<THREE.Texture>;
}

const cache = new Map<TextureKey, CacheEntry>();
let sharedLoader: THREE.TextureLoader | null = null;

function getLoader(): THREE.TextureLoader {
  if (!sharedLoader) sharedLoader = new THREE.TextureLoader();
  return sharedLoader;
}

export type TextureRole = "albedo" | "normal" | "roughness" | "metalness" | "ao";

function configureTexture(tex: THREE.Texture, role: TextureRole): void {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (role === "albedo") {
    tex.colorSpace = THREE.SRGBColorSpace;
  } else {
    tex.colorSpace = THREE.NoColorSpace;
  }
}

/**
 * Load (and cache) a texture from a URL. Returns the same THREE.Texture
 * instance to every caller for a given URL. Concurrent calls dedupe onto
 * the same underlying HTTP request.
 */
export function loadTexture(url: string, role: TextureRole = "albedo"): Promise<THREE.Texture> {
  const cached = cache.get(url);
  if (cached) return cached.loading;

  const loader = getLoader();
  let entry!: CacheEntry;
  const loading = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        configureTexture(tex, role);
        entry.texture = tex;
        resolve(tex);
      },
      undefined,
      (err) => {
        // On failure, evict so subsequent calls can retry.
        cache.delete(url);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });

  // Placeholder texture returned synchronously — replaced by the real one
  // once `loading` resolves. Callers who don't await get a valid but empty
  // texture that renders as `#000000` until the load completes.
  const placeholder = new THREE.Texture();
  configureTexture(placeholder, role);
  entry = { texture: placeholder, loading };
  cache.set(url, entry);
  return loading;
}

/** Synchronous accessor — returns undefined if the URL has never been
 *  loaded. Used by the material factory to attach textures that were
 *  already loaded by a prior mesh. */
export function peekTexture(url: string): THREE.Texture | undefined {
  return cache.get(url)?.texture;
}

/** For tests: reset the cache. Not for production use. */
export function __resetTextureCacheForTests(): void {
  cache.clear();
}

/** Diagnostic: how many entries are currently cached. */
export function textureCacheSize(): number {
  return cache.size;
}
