// Regression: TransformControls must manipulate the INSTANCE scale, not
// the GLB normalization scale. This is enforced structurally by the
// scene hierarchy — the gizmo attaches to the OUTER instance <group>
// (owned by SceneAssetItem) whose scale is bound to
// `instance.scale.{x,y,z}`. The inner normalization <group> and the
// clone's authored root are children and are NEVER the gizmo's target.
//
// This file locks the contract at the shared-type / commit-shape level.
// See `SceneAssetTransformGizmo.tsx#readPatchFromTarget` for the actual
// implementation: it reads target.scale (the outer group) and writes it
// into `SceneAssetInstance.scale`.

import { describe, expect, it } from "vitest";
import {
  MAX_INSTANCE_SCALE,
  MIN_INSTANCE_SCALE,
  sceneAssetInstanceUpdateSchema,
} from "../scene-asset-instance";

describe("Gizmo commit path — scale patch shape", () => {
  it("Zod update schema accepts a scale patch shaped like target.scale (Vec3)", () => {
    const patch = {
      positionMm: { x: 1000, y: 0, z: 500 },
      rotationDeg: { x: 0, y: 45, z: 0 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    };
    const parsed = sceneAssetInstanceUpdateSchema.safeParse(patch);
    expect(parsed.success).toBe(true);
  });

  it("Zod update schema rejects a scale below MIN_INSTANCE_SCALE (server bounds hold)", () => {
    const bad = {
      scale: { x: MIN_INSTANCE_SCALE / 2, y: 1, z: 1 },
    };
    const parsed = sceneAssetInstanceUpdateSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("Zod update schema rejects a scale above MAX_INSTANCE_SCALE (server bounds hold)", () => {
    const bad = {
      scale: { x: 1, y: MAX_INSTANCE_SCALE * 2, z: 1 },
    };
    const parsed = sceneAssetInstanceUpdateSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("Zod update schema rejects NaN scale (protects renderer from broken transform prop)", () => {
    const bad = { scale: { x: Number.NaN, y: 1, z: 1 } };
    const parsed = sceneAssetInstanceUpdateSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("Zod update schema rejects zero scale (protects renderer from invisible collapsed geometry)", () => {
    const bad = { scale: { x: 0, y: 1, z: 1 } };
    const parsed = sceneAssetInstanceUpdateSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});
