import { describe, expect, it } from "vitest";
import {
  assertScopeConsistent,
  canRead as canReadSceneAssetDefinition,
  canWrite as canWriteSceneAssetDefinition,
  sceneAssetDefinitionCreateSchema,
  sceneAssetDefinitionPatchSchema,
  toSceneAssetDefinition,
  type SceneAssetDefinitionRecord,
} from "../definition-persistence";

function makeRecord(overrides: Partial<SceneAssetDefinitionRecord> = {}): SceneAssetDefinitionRecord {
  return {
    id: "def_abc",
    scope: "org",
    orgId: "org_1",
    slug: null,
    name: "Refrigerator",
    description: null,
    category: "appliance",
    widthMm: 900,
    heightMm: 1800,
    depthMm: 700,
    placement: { floorMounted: true },
    collision: { enabled: true },
    model: {
      format: "glb",
      assetKey: "appliance/def_abc/v1/model.glb",
      thumbnailKey: "appliance/def_abc/v1/thumbnail.webp",
    },
    provenance: { sourceName: "Poly Haven", license: "CC0-1.0" },
    metadata: null,
    assetKey: "appliance/def_abc/v1/model.glb",
    thumbnailKey: "appliance/def_abc/v1/thumbnail.webp",
    manufacturer: null,
    sku: null,
    tags: [],
    family: "def_abc",
    revision: 1,
    active: true,
    systemManaged: false,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("toSceneAssetDefinition — DB row → runtime shape", () => {
  it("projects a record into the runtime SceneAssetDefinition shape existing consumers already speak", () => {
    const def = toSceneAssetDefinition(makeRecord());
    expect(def.id).toBe("def_abc");
    expect(def.version).toBe(1);
    expect(def.category).toBe("appliance");
    expect(def.dimensionsMm).toEqual({ widthMm: 900, heightMm: 1800, depthMm: 700 });
    expect(def.model?.assetKey).toBe("appliance/def_abc/v1/model.glb");
    expect(def.provenance?.license).toBe("CC0-1.0");
  });

  it("prefers the row's top-level thumbnailKey over the model-nested one", () => {
    const def = toSceneAssetDefinition(
      makeRecord({ thumbnailKey: "appliance/def_abc/v1/override.webp" }),
    );
    expect(def.thumbnailKey).toBe("appliance/def_abc/v1/override.webp");
  });

  it("propagates the `active` flag onto the runtime shape (needed for CatalogPanel filtering)", () => {
    const active = toSceneAssetDefinition(makeRecord({ active: true }));
    const archived = toSceneAssetDefinition(makeRecord({ active: false }));
    expect(active.active).toBe(true);
    expect(archived.active).toBe(false);
  });

  it("passes primitive-only records (no model) cleanly", () => {
    const def = toSceneAssetDefinition(
      makeRecord({ model: null, assetKey: null, thumbnailKey: null }),
    );
    expect(def.model).toBeUndefined();
    expect(def.thumbnailKey).toBeUndefined();
  });
});

describe("sceneAssetDefinitionCreateSchema", () => {
  const minimal = {
    name: "New asset",
    category: "furniture" as const,
    dimensionsMm: { widthMm: 500, heightMm: 700, depthMm: 400 },
  };

  it("accepts the minimum required shape", () => {
    expect(sceneAssetDefinitionCreateSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects invalid dimensions", () => {
    for (const dims of [
      { widthMm: 0, heightMm: 700, depthMm: 400 },
      { widthMm: 500, heightMm: -1, depthMm: 400 },
      { widthMm: 500, heightMm: 700, depthMm: 0 },
    ]) {
      expect(
        sceneAssetDefinitionCreateSchema.safeParse({ ...minimal, dimensionsMm: dims }).success,
      ).toBe(false);
    }
  });

  it("rejects an unknown category", () => {
    expect(
      sceneAssetDefinitionCreateSchema.safeParse({ ...minimal, category: "unicorn" }).success,
    ).toBe(false);
  });

  it("rejects a provenance without license", () => {
    expect(
      sceneAssetDefinitionCreateSchema.safeParse({
        ...minimal,
        provenance: { sourceName: "x" } as unknown as { sourceName: string; license: string },
      }).success,
    ).toBe(false);
  });

  it("rejects a model with a malformed assetKey (missing extension)", () => {
    expect(
      sceneAssetDefinitionCreateSchema.safeParse({
        ...minimal,
        model: { format: "glb", assetKey: "" },
      }).success,
    ).toBe(false);
  });
});

describe("sceneAssetDefinitionPatchSchema", () => {
  it("accepts an empty patch", () => {
    expect(sceneAssetDefinitionPatchSchema.safeParse({}).success).toBe(true);
  });
  it("accepts nullable clears on optional fields", () => {
    expect(
      sceneAssetDefinitionPatchSchema.safeParse({
        placement: null,
        collision: null,
        thumbnailKey: null,
      }).success,
    ).toBe(true);
  });
  it("rejects zero dimensions in a patch", () => {
    expect(
      sceneAssetDefinitionPatchSchema.safeParse({
        dimensionsMm: { widthMm: 0, heightMm: 700, depthMm: 400 },
      }).success,
    ).toBe(false);
  });
});

describe("assertScopeConsistent", () => {
  it("system requires orgId=null", () => {
    expect(() => assertScopeConsistent("system", null)).not.toThrow();
    expect(() => assertScopeConsistent("system", "org_1")).toThrow(/SYSTEM/);
  });
  it("org requires a non-null orgId", () => {
    expect(() => assertScopeConsistent("org", "org_1")).not.toThrow();
    expect(() => assertScopeConsistent("org", null)).toThrow(/Organization/);
  });
});

describe("Tenancy — canRead", () => {
  it("system records visible to every org", () => {
    const rec = makeRecord({ scope: "system", orgId: null });
    expect(canReadSceneAssetDefinition(rec, { orgId: "any", isPlatformAdmin: false })).toBe(true);
  });
  it("org records visible only to their own org", () => {
    const rec = makeRecord({ scope: "org", orgId: "org_a" });
    expect(canReadSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: false })).toBe(true);
    expect(canReadSceneAssetDefinition(rec, { orgId: "org_b", isPlatformAdmin: false })).toBe(false);
  });
  it("archived records hidden from non-admins", () => {
    const rec = makeRecord({ scope: "system", orgId: null, active: false });
    expect(canReadSceneAssetDefinition(rec, { orgId: "any", isPlatformAdmin: false })).toBe(false);
    expect(canReadSceneAssetDefinition(rec, { orgId: "any", isPlatformAdmin: true })).toBe(true);
  });
});

describe("Tenancy — canWrite", () => {
  it("system-managed records only mutable by platform admin", () => {
    const rec = makeRecord({ scope: "system", orgId: null, systemManaged: true });
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: false })).toBe(false);
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: true })).toBe(true);
  });
  it("system records (non-system-managed) still require admin", () => {
    const rec = makeRecord({ scope: "system", orgId: null, systemManaged: false });
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: false })).toBe(false);
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: true })).toBe(true);
  });
  it("org records mutable by their own org", () => {
    const rec = makeRecord({ scope: "org", orgId: "org_a" });
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: false })).toBe(true);
    expect(canWriteSceneAssetDefinition(rec, { orgId: "org_b", isPlatformAdmin: false })).toBe(false);
  });
});

describe("Tenancy — adversarial defense in depth", () => {
  // These tests document the invariants the API-route layer relies on
  // to defeat forged request payloads. If any of them ever start
  // passing where they should fail, an attacker could escalate scope
  // or leak another org's data.

  it("a non-admin cannot read another org's private asset even if they claim admin=false-but-orgId-matches nothing", () => {
    const rec = makeRecord({ scope: "org", orgId: "org_a" });
    expect(canReadSceneAssetDefinition(rec, { orgId: "org_b", isPlatformAdmin: false })).toBe(false);
  });

  it("changing scope to system on the target record still requires admin (upgrade attempt)", () => {
    // Existing org-scoped record — a non-admin trying to convert to
    // system by patching cannot succeed: canWrite is evaluated on the
    // CURRENT record, and any attempt to promote requires admin to
    // also pass on the SYSTEM-shaped target (defense at both ends).
    const orgRec = makeRecord({ scope: "org", orgId: "org_a" });
    expect(canWriteSceneAssetDefinition(orgRec, { orgId: "org_a", isPlatformAdmin: false })).toBe(true);
    const systemRec = makeRecord({ scope: "system", orgId: null });
    expect(canWriteSceneAssetDefinition(systemRec, { orgId: "org_a", isPlatformAdmin: false })).toBe(false);
  });

  it("assertScopeConsistent rejects impossible combos an attacker might forge", () => {
    // A payload claiming scope="system" alongside an orgId — nonsense
    // — must throw before any DB write.
    expect(() => assertScopeConsistent("system", "org_a")).toThrow();
    // Its mirror: scope="org" with no orgId is equally nonsensical.
    expect(() => assertScopeConsistent("org", null)).toThrow();
  });

  it("archived SYSTEM records remain readable by admin for the render path (existing instances)", () => {
    // Rendering an archived room instance must still resolve the
    // definition — the RENDER resolver passes isPlatformAdmin=true (or
    // an equivalent bypass) so archived items keep painting.
    const rec = makeRecord({ scope: "system", orgId: null, active: false });
    expect(canReadSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: false })).toBe(false);
    expect(canReadSceneAssetDefinition(rec, { orgId: "org_a", isPlatformAdmin: true })).toBe(true);
  });
});
