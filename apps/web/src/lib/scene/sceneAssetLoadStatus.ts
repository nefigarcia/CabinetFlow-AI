"use client";

// Development-only registry for the GLB load status of every Scene Asset
// URL the render path has attempted. Written to by `SceneAssetLoader`
// (on successful useGLTF resolution) and by `SceneAssetErrorBoundary`
// (on load failure). Also holds the result of a manual, out-of-band
// `THREE.GLTFLoader.load` probe kicked off from the inspector — this
// bypasses `useGLTF` + React Suspense so we can distinguish a genuine
// loader/parser failure from a Suspense/cache-related failure.
//
// Snapshot stability contract:
//   `getSceneAssetLoadStatus` and `getProbeStatus` are read by
//   `useSyncExternalStore` on EVERY render of the inspector. React
//   requires their return value to be a stable reference until an
//   actual mutation happens — otherwise it treats each call as a store
//   change and re-renders infinitely. To satisfy this:
//     · Missing entries return the SAME singleton (`IDLE_PROBE_STATUS`
//       for probes, `null` for load-status).
//     · Writers first compare against the existing entry and skip both
//       the `Map.set` and `notify()` when the value is byte-equivalent
//       — no spurious subscriber churn on repeated identical writes.
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
  /** Error.message from the load site. */
  message: string;
  /** Error.name (TypeError, SyntaxError, HttpError, etc.) — helps
   *  distinguish "Failed to fetch" TypeError from parser SyntaxErrors. */
  errorName?: string;
  /** Full Error.stack for the browser console. */
  stack?: string;
  updatedAt: number;
}

export type SceneAssetLoadStatus =
  | SceneAssetLoadedRecord
  | SceneAssetFailedRecord;

/** Out-of-band `THREE.GLTFLoader.load` probe result — records what a
 *  vanilla GLTFLoader (no React, no Suspense, no cache) reports for
 *  the same URL. If this succeeds and `useGLTF` fails, the failure is
 *  in the R3F integration, not the loader or the GLB itself. */
export interface SceneAssetProbeIdle {
  kind: "idle";
}
export interface SceneAssetProbeRunning {
  kind: "running";
  url: string;
  startedAt: number;
  loadedBytes?: number;
  totalBytes?: number;
}
export interface SceneAssetProbeSucceeded {
  kind: "succeeded";
  url: string;
  meshCount: number;
  sceneChildren: number;
  rawBboxMeters: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  extensionsUsed: readonly string[];
  extensionsRequired: readonly string[];
  finishedAt: number;
}
export interface SceneAssetProbeFailed {
  kind: "failed";
  url: string;
  message: string;
  errorName?: string;
  stack?: string;
  finishedAt: number;
}
export type SceneAssetProbeStatus =
  | SceneAssetProbeIdle
  | SceneAssetProbeRunning
  | SceneAssetProbeSucceeded
  | SceneAssetProbeFailed;

/** Stable singleton returned when no probe has run for a URL. Must not
 *  be replaced by a fresh literal on each `getProbeStatus` call — see
 *  the snapshot-stability contract above. */
const IDLE_PROBE_STATUS: SceneAssetProbeIdle = { kind: "idle" };

const store = new Map<string, SceneAssetLoadStatus>();
const probeStore = new Map<string, SceneAssetProbeStatus>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function loadedRecordEquivalent(
  prev: SceneAssetLoadStatus | undefined,
  next: Omit<SceneAssetLoadedRecord, "kind" | "updatedAt">,
): boolean {
  if (!prev || prev.kind !== "loaded") return false;
  if (prev.url !== next.url) return false;
  if (prev.meshCount !== next.meshCount) return false;
  if (prev.normalizationScale !== next.normalizationScale) return false;
  const a = prev.rawBboxMeters;
  const b = next.rawBboxMeters;
  return (
    a.min.x === b.min.x &&
    a.min.y === b.min.y &&
    a.min.z === b.min.z &&
    a.max.x === b.max.x &&
    a.max.y === b.max.y &&
    a.max.z === b.max.z
  );
}

function failedRecordEquivalent(
  prev: SceneAssetLoadStatus | undefined,
  url: string,
  message: string,
  errorName: string | undefined,
): boolean {
  if (!prev || prev.kind !== "failed") return false;
  return (
    prev.url === url &&
    prev.message === message &&
    prev.errorName === errorName
  );
}

export function recordSceneAssetLoaded(
  record: Omit<SceneAssetLoadedRecord, "kind" | "updatedAt">,
): void {
  if (loadedRecordEquivalent(store.get(record.url), record)) return;
  store.set(record.url, { ...record, kind: "loaded", updatedAt: Date.now() });
  notify();
}

export function recordSceneAssetFailed(
  url: string,
  error: Error | { message: string; name?: string; stack?: string },
): void {
  const message = error.message;
  const errorName = (error as Error).name;
  if (failedRecordEquivalent(store.get(url), url, message, errorName)) return;
  store.set(url, {
    kind: "failed",
    url,
    message,
    errorName,
    stack: (error as Error).stack,
    updatedAt: Date.now(),
  });
  notify();
}

export function getSceneAssetLoadStatus(
  url: string | null | undefined,
): SceneAssetLoadStatus | null {
  if (!url) return null;
  return store.get(url) ?? null;
}

function probeStatusEquivalent(
  prev: SceneAssetProbeStatus | undefined,
  next: SceneAssetProbeStatus,
): boolean {
  if (!prev) return next.kind === "idle";
  if (prev.kind !== next.kind) return false;
  switch (next.kind) {
    case "idle":
      return true;
    case "running": {
      const p = prev as SceneAssetProbeRunning;
      return (
        p.url === next.url &&
        p.startedAt === next.startedAt &&
        p.loadedBytes === next.loadedBytes &&
        p.totalBytes === next.totalBytes
      );
    }
    case "succeeded": {
      const p = prev as SceneAssetProbeSucceeded;
      // finishedAt is monotonic — comparing everything else is enough
      // to dedupe the single terminal write.
      return (
        p.url === next.url &&
        p.meshCount === next.meshCount &&
        p.sceneChildren === next.sceneChildren &&
        p.finishedAt === next.finishedAt
      );
    }
    case "failed": {
      const p = prev as SceneAssetProbeFailed;
      return (
        p.url === next.url &&
        p.message === next.message &&
        p.finishedAt === next.finishedAt
      );
    }
  }
}

export function recordProbeStatus(
  url: string,
  status: SceneAssetProbeStatus,
): void {
  if (probeStatusEquivalent(probeStore.get(url), status)) return;
  probeStore.set(url, status);
  notify();
}

export function getProbeStatus(
  url: string | null | undefined,
): SceneAssetProbeStatus {
  if (!url) return IDLE_PROBE_STATUS;
  return probeStore.get(url) ?? IDLE_PROBE_STATUS;
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeSceneAssetLoadStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
