import { describe, expect, it } from "vitest";
import type { SceneAssetInstance, SceneAssetInstanceCreateInput } from "../scene-asset-instance";
import {
  IDENTITY_ROTATION,
  SCENE_ASSET_INSTANCE_SCHEMA_VERSION,
  sceneAssetInstanceCreateSchema,
  sceneAssetInstanceSchema,
  sceneAssetInstanceUpdateSchema,
  vec3Schema,
  withInstanceDefaults,
} from "../scene-asset-instance";

function makeInstance(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "inst_1",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa-modern-01",
    positionMm: { x: 2400, y: 0, z: 3200 },
    rotationDeg: { x: 0, y: 90, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    placement: { mode: "free" },
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("SceneAssetInstance — schema", () => {
  it("exposes a schemaVersion constant for future evolution", () => {
    expect(SCENE_ASSET_INSTANCE_SCHEMA_VERSION).toBe("1.0");
  });

  it("parses a well-formed instance", () => {
    const inst = makeInstance();
    expect(sceneAssetInstanceSchema.parse(inst)).toEqual(inst);
  });

  it("round-trips through JSON without losing information", () => {
    const inst = makeInstance({
      materialOverrides: { upholstery: "fabric-cream", frame: "metal-matte-black" },
    });
    const restored = sceneAssetInstanceSchema.parse(JSON.parse(JSON.stringify(inst)));
    expect(restored).toEqual(inst);
  });

  it("rejects instances missing tenancy fields", () => {
    const bad = { ...makeInstance() } as Partial<SceneAssetInstance>;
    delete bad.orgId;
    expect(() => sceneAssetInstanceSchema.parse(bad)).toThrow();
  });

  it("rejects non-numeric position values", () => {
    const bad = { ...makeInstance(), positionMm: { x: "0", y: 0, z: 0 } };
    expect(() => sceneAssetInstanceSchema.parse(bad)).toThrow();
  });

  it("allows negative rotation values (angles can be signed)", () => {
    expect(() =>
      sceneAssetInstanceSchema.parse(makeInstance({ rotationDeg: { x: -45, y: 0, z: 0 } })),
    ).not.toThrow();
  });

  it("allows negative position values (world origin isn't a corner)", () => {
    expect(() =>
      sceneAssetInstanceSchema.parse(makeInstance({ positionMm: { x: -500, y: 0, z: -500 } })),
    ).not.toThrow();
  });

  it("does NOT carry projectId (ownership is via room.project, not persisted)", () => {
    const inst = makeInstance();
    expect(inst).not.toHaveProperty("projectId");
    // The Zod schema's `.parse()` returns only declared keys; verify it
    // strips a stray projectId if a legacy payload includes one.
    const withStray = { ...inst, projectId: "proj_legacy" };
    const parsed = sceneAssetInstanceSchema.parse(withStray) as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("projectId");
  });
});

describe("Vec3 schema", () => {
  it("accepts a well-formed vec3", () => {
    expect(vec3Schema.parse({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("rejects missing components", () => {
    expect(() => vec3Schema.parse({ x: 1, y: 2 })).toThrow();
  });
});

describe("SceneAssetInstance create input", () => {
  it("accepts the minimum create shape", () => {
    const input: SceneAssetInstanceCreateInput = {
      assetDefinitionId: "sofa-modern-01",
      positionMm: { x: 0, y: 0, z: 0 },
    };
    expect(sceneAssetInstanceCreateSchema.parse(input)).toEqual(input);
  });

  it("keeps tenancy fields off the create shape (compile-time guard)", () => {
    const shape: SceneAssetInstanceCreateInput = {
      assetDefinitionId: "sofa-modern-01",
      positionMm: { x: 0, y: 0, z: 0 },
    };
    // @ts-expect-error orgId is intentionally not part of the create shape
    shape.orgId = "org_1";
    // @ts-expect-error roomId is intentionally not part of the create shape
    shape.roomId = "room_1";
    // @ts-expect-error projectId is intentionally not part of the create shape
    shape.projectId = "proj_1";
  });

  it("keeps scale off the create shape (identity only for MVP)", () => {
    const shape: SceneAssetInstanceCreateInput = {
      assetDefinitionId: "sofa-modern-01",
      positionMm: { x: 0, y: 0, z: 0 },
    };
    // @ts-expect-error scale is not user-editable in MVP
    shape.scale = { x: 2, y: 2, z: 2 };
  });

  describe("withInstanceDefaults", () => {
    it("fills identity rotation and visible=true", () => {
      const input: SceneAssetInstanceCreateInput = {
        assetDefinitionId: "sofa-modern-01",
        positionMm: { x: 100, y: 0, z: 100 },
      };
      expect(withInstanceDefaults(input)).toEqual({
        assetDefinitionId: "sofa-modern-01",
        positionMm: { x: 100, y: 0, z: 100 },
        rotationDeg: IDENTITY_ROTATION,
        visible: true,
        placement: { mode: "free" },
        materialOverrides: undefined,
      });
    });

    it("preserves user-provided rotation and visibility", () => {
      const input: SceneAssetInstanceCreateInput = {
        assetDefinitionId: "sofa-modern-01",
        positionMm: { x: 0, y: 0, z: 0 },
        rotationDeg: { x: 0, y: 45, z: 0 },
        visible: false,
      };
      const out = withInstanceDefaults(input);
      expect(out.rotationDeg).toEqual({ x: 0, y: 45, z: 0 });
      expect(out.visible).toBe(false);
    });

    it("does not mutate the input", () => {
      const input: SceneAssetInstanceCreateInput = {
        assetDefinitionId: "sofa-modern-01",
        positionMm: { x: 0, y: 0, z: 0 },
      };
      withInstanceDefaults(input);
      expect(input.rotationDeg).toBeUndefined();
      expect(input.visible).toBeUndefined();
    });
  });
});

describe("SceneAssetInstance update input", () => {
  it("accepts an empty patch", () => {
    expect(() => sceneAssetInstanceUpdateSchema.parse({})).not.toThrow();
  });

  it("accepts partial patches", () => {
    expect(() =>
      sceneAssetInstanceUpdateSchema.parse({ positionMm: { x: 1, y: 2, z: 3 } }),
    ).not.toThrow();
    expect(() =>
      sceneAssetInstanceUpdateSchema.parse({ visible: false }),
    ).not.toThrow();
  });

  it("rejects a wrong-shape position patch", () => {
    expect(() =>
      sceneAssetInstanceUpdateSchema.parse({ positionMm: { x: 1, y: 2 } }),
    ).toThrow();
  });

  it("strips scale from update payloads (identity only for MVP)", () => {
    // Zod `.parse()` accepts unknown at compile time, so a runtime object
    // with an extra `scale` field compiles fine. The important guarantee
    // is that Zod's declared schema DOESN'T include scale, so the parsed
    // result never carries it.
    const parsed = sceneAssetInstanceUpdateSchema.parse({
      positionMm: { x: 1, y: 2, z: 3 },
      scale: { x: 5, y: 5, z: 5 },
    } as unknown) as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("scale");
  });
});
