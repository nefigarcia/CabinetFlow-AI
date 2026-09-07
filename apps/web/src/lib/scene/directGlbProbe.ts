"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { recordProbeStatus } from "./sceneAssetLoadStatus";

// Out-of-band GLB probe — runs a fresh `THREE.GLTFLoader.load` against
// the same URL that `useGLTF` receives. Bypasses:
//   · @react-three/drei's useGLTF wrapper
//   · @react-three/fiber's useLoader cache
//   · React Suspense
// If this succeeds while useGLTF fails, the failure is in the R3F
// integration, not the loader or the GLB itself. If this fails, the
// error object it produces is the ground-truth THREE.js error (name,
// message, stack) — the boundary path may have wrapped or renamed it.
//
// The result is written to the sceneAssetLoadStatus registry keyed by
// URL and rendered by the dev-only Model panel in SceneAssetInspector.

export interface DirectGlbProbeResult {
  ok: boolean;
  message: string;
}

/** Throttle progress publishes so a 32MB GLB doesn't emit 1000+ writes
 *  to the registry (which would drive the inspector to re-render on
 *  every progress tick). Publish only when loadedBytes advances by at
 *  least this much, plus a terminal write on completion. */
const PROGRESS_PUBLISH_THRESHOLD_BYTES = 256 * 1024;

export async function runDirectGlbProbe(
  url: string,
): Promise<DirectGlbProbeResult> {
  const startedAt = Date.now();
  recordProbeStatus(url, { kind: "running", url, startedAt });
  console.log("[directGlbProbe] START", url);
  let lastPublishedBytes = 0;

  return new Promise<DirectGlbProbeResult>((resolve) => {
    const loader = new GLTFLoader();
    try {
      loader.load(
        url,
        (gltf) => {
          try {
            let meshes = 0;
            gltf.scene.traverse((obj) => {
              if ((obj as THREE.Mesh).isMesh) meshes += 1;
            });
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const raw = {
              min: { x: box.min.x, y: box.min.y, z: box.min.z },
              max: { x: box.max.x, y: box.max.y, z: box.max.z },
            };
            // asset.extensionsUsed / extensionsRequired are on the parser
            // result under `gltf.parser.json` (raw glTF JSON). The parser
            // itself is not always exposed; fall back to empty arrays.
            const rawJson =
              (gltf as unknown as { parser?: { json?: Record<string, unknown> } })
                .parser?.json ?? {};
            const extensionsUsed =
              (rawJson.extensionsUsed as string[] | undefined) ?? [];
            const extensionsRequired =
              (rawJson.extensionsRequired as string[] | undefined) ?? [];

            console.log("[directGlbProbe] SUCCESS", url, {
              meshes,
              sceneChildren: gltf.scene.children.length,
              rawBboxMeters: raw,
              extensionsUsed,
              extensionsRequired,
            });
            recordProbeStatus(url, {
              kind: "succeeded",
              url,
              meshCount: meshes,
              sceneChildren: gltf.scene.children.length,
              rawBboxMeters: raw,
              extensionsUsed,
              extensionsRequired,
              finishedAt: Date.now(),
            });
            resolve({ ok: true, message: `Parsed ${meshes} mesh(es).` });
          } catch (postErr) {
            console.error("[directGlbProbe] POST-PARSE ERROR", url, postErr);
            recordProbeStatus(url, {
              kind: "failed",
              url,
              message:
                postErr instanceof Error ? postErr.message : String(postErr),
              errorName:
                postErr instanceof Error ? postErr.name : undefined,
              stack: postErr instanceof Error ? postErr.stack : undefined,
              finishedAt: Date.now(),
            });
            resolve({
              ok: false,
              message:
                postErr instanceof Error ? postErr.message : String(postErr),
            });
          }
        },
        (progress) => {
          // Throttle: only publish (and log) when at least
          // PROGRESS_PUBLISH_THRESHOLD_BYTES have arrived since the
          // last publish. The final byte still counts because
          // `progress.loaded === progress.total` at completion.
          const advanced = progress.loaded - lastPublishedBytes;
          const isComplete =
            progress.total > 0 && progress.loaded >= progress.total;
          if (advanced < PROGRESS_PUBLISH_THRESHOLD_BYTES && !isComplete) return;
          lastPublishedBytes = progress.loaded;
          recordProbeStatus(url, {
            kind: "running",
            url,
            startedAt,
            loadedBytes: progress.loaded,
            totalBytes: progress.total,
          });
        },
        (err) => {
          const errorObj = err as unknown as Error;
          console.error("[directGlbProbe] FAIL", url, errorObj);
          recordProbeStatus(url, {
            kind: "failed",
            url,
            message: errorObj?.message ?? String(err),
            errorName: errorObj?.name,
            stack: errorObj?.stack,
            finishedAt: Date.now(),
          });
          resolve({
            ok: false,
            message: errorObj?.message ?? String(err),
          });
        },
      );
    } catch (syncErr) {
      console.error("[directGlbProbe] SYNC THROW", url, syncErr);
      recordProbeStatus(url, {
        kind: "failed",
        url,
        message: syncErr instanceof Error ? syncErr.message : String(syncErr),
        errorName: syncErr instanceof Error ? syncErr.name : undefined,
        stack: syncErr instanceof Error ? syncErr.stack : undefined,
        finishedAt: Date.now(),
      });
      resolve({
        ok: false,
        message: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }
  });
}
