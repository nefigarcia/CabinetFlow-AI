"use client";

// Development-only registry for the GLB load status of every Scene Asset
// URL the render path has attempted. Written to by `SceneAssetLoader`
// (on successful useGLTF resolution) and by `SceneAssetErrorBoundary`
// (on load failure). Read by `SceneAssetInspector` to render the
// dev-only "Model" status section.
//
// This exists because `useGLTF` swallows errors into an ErrorBoundary
// and returns a live scene on success — neither path exposes state to
// the surrounding UI. Without this registry, a screenshot of a
// primitive-looking box is UNANSWERABLE: it could be a genuine load
// that got normalized into a small envelope, or an error boundary
// fallback. The inspector can now say which.
//
// This file is safe to include in production builds; the inspector
// only surfaces it when `process.env.NODE_ENV !== "production"`.

export interface SceneAssetLoadedRecord {
  kind: "loaded";
  url: string;
  meshCount: number;
  /** Raw model-space bbox in meters, measured on the cloned scene
   *  before normalization was applied. */
  rawBboxMeters: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  /** Normalization scale (single scalar). 1 = no resize; <1 = shrunk to
   *  fit; >1 = grown to fit. */
  normalizationScale: number;
  updatedAt: number;
}

export interface SceneAssetFailedRecord {
  kind: "failed";
  url: string;
  message: string;
  updatedAt: number;
}

export type SceneAssetLoadStatus =
  | SceneAssetLoadedRecord
  | SceneAssetFailedRecord;

const store = new Map<string, SceneAssetLoadStatus>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function recordSceneAssetLoaded(
  record: Omit<SceneAssetLoadedRecord, "kind" | "updatedAt">,
): void {
  store.set(record.url, { ...record, kind: "loaded", updatedAt: Date.now() });
  notify();
}

export function recordSceneAssetFailed(url: string, message: string): void {
  store.set(url, { kind: "failed", url, message, updatedAt: Date.now() });
  notify();
}

export function getSceneAssetLoadStatus(
  url: string | null | undefined,
): SceneAssetLoadStatus | null {
  if (!url) return null;
  return store.get(url) ?? null;
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeSceneAssetLoadStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
