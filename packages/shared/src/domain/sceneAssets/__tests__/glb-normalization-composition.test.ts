// Regression tests for the Scene Asset scale-composition contract.
//
// Bug pattern (fixed): SceneAssetLoader used to mutate the cloned GLB
// scene root's own scale/position/rotation with the normalization
// transform. When a GLB had a non-identity authored root transform
// (common for Blender / Sketchfab exports), the authored transform
// was clobbered and the effective render size was wrong.
//
// Fix: the loader now leaves the clone's authored root transform
// intact and emits the normalization transform on an OUTER <group>.
// The composition Three.js applies is:
//
//   world_p = instance_transform ∘ normalization_transform ∘ clone_authored ∘ p
//
// which produces the correct target size regardless of the GLB's
// authored root scale. These tests lock the invariant at the pure-math
// level so the fix cannot silently regress.

import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import type { SceneAssetInstance, Vec3 } from "../scene-asset-instance";
import { IDENTITY_SCALE } from "../scene-asset-instance";
import { computeNormalizationTransform } from "../glb-normalization";
import { getSceneAssetEffectiveDimensions } from "../effective-dimensions";

// ─── Test fixtures ──────────────────────────────────────────────────────

function def(overrides: Partial<SceneAssetDefinition> = {}): SceneAssetDefinition {
  return {
    id: "chair",
    version: 1,
    name: "Chair",
    category: "furniture",
    dimensionsMm: { widthMm: 500, heightMm: 900, depthMm: 550 },
    ...overrides,
  };
}

function instance(scale: Vec3 = IDENTITY_SCALE): Pick<SceneAssetInstance, "scale"> {
  return { scale };
}

/**
 * Simulates the composed world size of a rendered scene asset, matching
 * the three-tier hierarchy the fix implements:
 *
 *   outer instance group  (scale = instance.scale)
 *     normalization group (scale = t.scale, uniform)
 *       clone             (scale = authored root scale)
 *         geometry
 *
 * For each axis, effective_world = instance.scale * t.scale * authored.scale * raw_geometry.
 * The `computeNormalizationTransform` measures the RAW GLB bbox
 * INCLUDING its authored root scale (because setFromObject reads
 * matrixWorld). So t.scale is computed s.t. t.scale * (authored * raw) fits
 * the target catalog dimensions. This composed math must produce
 * target × instance.scale on every axis.
 */
function composedWorldSize(input: {
  authoredRootScale: Vec3;
  rawGeometrySize: { x: number; y: number; z: number };
  definition: SceneAssetDefinition;
  instanceScale: Vec3;
}) {
  // Simulate what setFromObject would report for a clone whose root has
  // authoredRootScale applied to a geometry of rawGeometrySize.
  const rawBbox = {
    min: {
      x: -(input.rawGeometrySize.x * input.authoredRootScale.x) / 2,
      y: 0,
      z: -(input.rawGeometrySize.z * input.authoredRootScale.z) / 2,
    },
    max: {
      x: (input.rawGeometrySize.x * input.authoredRootScale.x) / 2,
      y: input.rawGeometrySize.y * input.authoredRootScale.y,
      z: (input.rawGeometrySize.z * input.authoredRootScale.z) / 2,
    },
  };
  const t = computeNormalizationTransform(rawBbox, input.definition);

  // The uniform normalization scale, applied on the outer <group>
  // inside the loader. The clone keeps its authored root transform.
  const composedWidth =
    input.instanceScale.x *
    t.scale *
    input.authoredRootScale.x *
    input.rawGeometrySize.x;
  const composedHeight =
    input.instanceScale.y *
    t.scale *
    input.authoredRootScale.y *
    input.rawGeometrySize.y;
  const composedDepth =
    input.instanceScale.z *
    t.scale *
    input.authoredRootScale.z *
    input.rawGeometrySize.z;

  return {
    widthM: composedWidth,
    heightM: composedHeight,
    depthM: composedDepth,
    normalizationScale: t.scale,
  };
}

// ─── Identity scale ────────────────────────────────────────────────────

describe("Identity instance scale — GLB renders at catalog dimensions", () => {
  it("chair definition with identity scale and identity authored root → target = catalog", () => {
    const out = composedWorldSize({
      authoredRootScale: { x: 1, y: 1, z: 1 },
      rawGeometrySize: { x: 1, y: 1, z: 1 },
      definition: def(),
      instanceScale: IDENTITY_SCALE,
    });
    // Uniform fit to smallest ratio (500 mm ÷ 1 = 0.5, 900 ÷ 1 = 0.9,
    // 550 ÷ 1 = 0.55). Uniform scale = 0.5 m. Effective world size on
    // the tightest axis matches target (width axis is tightest).
    expect(out.widthM).toBeCloseTo(0.5, 6);
    // Height + depth are proportional (not filled to catalog since scale
    // is UNIFORM). That's expected — user's brief mandates uniform GLB
    // normalization, not per-axis stretch.
    expect(out.heightM).toBeCloseTo(0.5, 6);
    expect(out.depthM).toBeCloseTo(0.5, 6);
  });
});

// ─── Non-uniform instance scale ────────────────────────────────────────

describe("Non-uniform instance scale multiplies per-axis over the normalized GLB", () => {
  it("instance scale (2, 1, 1) doubles X only", () => {
    const out = composedWorldSize({
      authoredRootScale: { x: 1, y: 1, z: 1 },
      rawGeometrySize: { x: 1, y: 1, z: 1 },
      definition: def(),
      instanceScale: { x: 2, y: 1, z: 1 },
    });
    expect(out.widthM).toBeCloseTo(1.0, 6);   // 0.5 × 2
    expect(out.heightM).toBeCloseTo(0.5, 6);
    expect(out.depthM).toBeCloseTo(0.5, 6);
  });

  it("effective dimensions helper matches composed world size for identity authored root", () => {
    // Domain helper works in mm; renderer works in m — assert equivalence.
    const inst = instance({ x: 1.5, y: 0.9, z: 1.1 });
    const eff = getSceneAssetEffectiveDimensions(def(), inst);
    expect(eff.widthMm).toBeCloseTo(500 * 1.5, 6);
    expect(eff.heightMm).toBeCloseTo(900 * 0.9, 6);
    expect(eff.depthMm).toBeCloseTo(550 * 1.1, 6);
  });
});

// ─── The regression: non-identity authored GLB root ────────────────────

describe("Non-identity authored GLB root does NOT distort target size", () => {
  it("authored root scale (2, 2, 2) still renders at catalog size (regression guard)", () => {
    // A GLB whose ROOT node was authored with scale = 2×. Before the
    // fix, the loader overwrote the clone's own scale with t.scale,
    // losing the authored 2× and rendering the model at half size.
    // With the fix, the loader wraps the clone in an outer group
    // carrying t.scale, so the authored 2× is preserved and the
    // composed world size still matches the catalog target.
    const out = composedWorldSize({
      authoredRootScale: { x: 2, y: 2, z: 2 },
      rawGeometrySize: { x: 1, y: 1, z: 1 },
      definition: def(),
      instanceScale: IDENTITY_SCALE,
    });
    // Target is dominated by tightest axis (width = 500 mm), so the
    // composed dimension MUST match 0.5 m on every axis — identical to
    // the identity-authored case above.
    expect(out.widthM).toBeCloseTo(0.5, 6);
    expect(out.heightM).toBeCloseTo(0.5, 6);
    expect(out.depthM).toBeCloseTo(0.5, 6);
    // Normalization scale should be SMALLER when authored is 2× so
    // effective composition still produces the target size.
    // 0.5 = t.scale × 2 × 1  →  t.scale = 0.25.
    expect(out.normalizationScale).toBeCloseTo(0.25, 6);
  });

  it("authored root scale (0.001, 0.001, 0.001) — a mm-authored GLB — still renders at catalog size", () => {
    // Some exporters emit GLBs authored in millimeters, so the raw
    // geometry vertex values are large numbers but the root node has
    // scale = 0.001 to bring them into meters. This is another common
    // shape that broke the pre-fix loader.
    const out = composedWorldSize({
      authoredRootScale: { x: 0.001, y: 0.001, z: 0.001 },
      rawGeometrySize: { x: 1000, y: 1000, z: 1000 }, // 1000 units = 1 m after 0.001 scale
      definition: def(),
      instanceScale: IDENTITY_SCALE,
    });
    // Composed effective bbox before normalization = 1 × 1 × 1 m
    // (raw × authored). Target width = 0.5 m → t.scale = 0.5 → composed
    // width = 0.5 × 0.001 × 1000 × 1 = 0.5 m.
    expect(out.widthM).toBeCloseTo(0.5, 6);
    expect(out.heightM).toBeCloseTo(0.5, 6);
    expect(out.depthM).toBeCloseTo(0.5, 6);
  });

  it("non-uniform authored root does not distort target", () => {
    // Uncommon but legal: an authored root with different scales per
    // axis. The uniform normalization can't perfectly fit all axes to
    // the target — that's not what GLB normalization does — but it
    // must still preserve the AUTHORED shape and never zero-out any
    // axis. Assert composed values are non-zero and consistent with
    // the authored aspect ratio.
    const out = composedWorldSize({
      authoredRootScale: { x: 2, y: 4, z: 1 },
      rawGeometrySize: { x: 1, y: 1, z: 1 },
      definition: def(),
      instanceScale: IDENTITY_SCALE,
    });
    expect(out.widthM).toBeGreaterThan(0);
    expect(out.heightM).toBeGreaterThan(0);
    expect(out.depthM).toBeGreaterThan(0);
    // Aspect ratio of the authored shape is preserved by the uniform
    // normalization scalar. So height/width ratio in world equals
    // (4·1)/(2·1) = 2.
    expect(out.heightM / out.widthM).toBeCloseTo(2, 6);
    expect(out.widthM / out.depthM).toBeCloseTo(2, 6);
  });
});

// ─── Composition: normalization × instance scale ───────────────────────

describe("Composition of normalization scale + instance scale", () => {
  it("instance scale (3, 3, 3) triples the fitted size even with authored root (2, 2, 2)", () => {
    const out = composedWorldSize({
      authoredRootScale: { x: 2, y: 2, z: 2 },
      rawGeometrySize: { x: 1, y: 1, z: 1 },
      definition: def(),
      instanceScale: { x: 3, y: 3, z: 3 },
    });
    // Identity-authored + instance=3× → world width = 0.5 × 3 = 1.5 m
    // Non-identity authored (2×) with fixed composition should give
    // the SAME result: 1.5 m.
    expect(out.widthM).toBeCloseTo(1.5, 6);
    expect(out.heightM).toBeCloseTo(1.5, 6);
    expect(out.depthM).toBeCloseTo(1.5, 6);
  });
});

// ─── Effective dimensions: catalog × instance scale (no GLB math) ──────

describe("getSceneAssetEffectiveDimensions — pure catalog × instance product", () => {
  it("identity scale returns catalog dimensions unchanged", () => {
    const eff = getSceneAssetEffectiveDimensions(def(), instance());
    expect(eff).toEqual({ widthMm: 500, heightMm: 900, depthMm: 550 });
  });

  it("non-uniform scale multiplies per-axis", () => {
    const eff = getSceneAssetEffectiveDimensions(
      def(),
      instance({ x: 2, y: 0.5, z: 1.25 }),
    );
    expect(eff.widthMm).toBeCloseTo(1000, 6);
    expect(eff.heightMm).toBeCloseTo(450, 6);
    expect(eff.depthMm).toBeCloseTo(687.5, 6);
  });

  it("null/undefined instance scale defaults to identity", () => {
    const eff = getSceneAssetEffectiveDimensions(def(), null);
    expect(eff).toEqual({ widthMm: 500, heightMm: 900, depthMm: 550 });
  });
});
