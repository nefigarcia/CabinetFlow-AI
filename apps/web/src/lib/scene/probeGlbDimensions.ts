"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Client-side probe of a GLB file's world bounding box. Runs entirely
// in the browser (no server round-trip) so the Add Asset modal can
// pre-fill the dimensions inputs the moment the user picks a file.
//
// Only supports .glb (binary) — a .gltf file typically references
// external images / bins that would need a resolver; unsupported here.
//
// GLBs are authored in meters; the returned dimensions are in
// millimeters, rounded to the nearest integer to match the catalog
// convention. Values that come back as 0 (empty geometry) or NaN
// signal a probe failure and are returned as null so the caller can
// keep the previous defaults instead of silently zeroing the fields.

export interface ProbedGlbDimensions {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export async function probeGlbDimensionsMm(
  file: File,
): Promise<ProbedGlbDimensions | null> {
  if (!file.name.toLowerCase().endsWith(".glb")) return null;

  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();

  const gltf = await new Promise<{ scene: THREE.Object3D } | null>((resolve) => {
    try {
      loader.parse(
        buffer,
        "",
        (result) => resolve(result as unknown as { scene: THREE.Object3D }),
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
  if (!gltf) return null;

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    return null;
  }
  const widthMm = Math.round(size.x * 1000);
  const heightMm = Math.round(size.y * 1000);
  const depthMm = Math.round(size.z * 1000);
  if (widthMm <= 0 || heightMm <= 0 || depthMm <= 0) return null;

  return { widthMm, heightMm, depthMm };
}
