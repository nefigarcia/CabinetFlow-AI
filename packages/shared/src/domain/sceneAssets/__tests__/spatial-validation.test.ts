import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import type { SceneAssetInstance } from "../scene-asset-instance";
import { validateSceneAssetPlacement } from "../spatial-validation";

const ROOM = { widthMm: 4000, heightMm: 2500, depthMm: 4000 };

function sofa(): SceneAssetDefinition {
  return {
    id: "sofa",
    version: 1,
    name: "Sofa",
    category: "furniture",
    dimensionsMm: { widthMm: 2000, heightMm: 800, depthMm: 1000 },
  };
}

function rug(): SceneAssetDefinition {
  return {
    id: "rug",
    version: 1,
    name: "Rug",
    category: "rug",
    dimensionsMm: { widthMm: 2000, heightMm: 20, depthMm: 3000 },
    collision: { enabled: false },
  };
}

function fridge(): SceneAssetDefinition {
  return {
    id: "fridge",
    version: 1,
    name: "Refrigerator",
    category: "appliance",
    dimensionsMm: { widthMm: 900, heightMm: 1800, depthMm: 700 },
    collision: {
      enabled: true,
      clearanceFrontMm: 900,
      clearanceBackMm: 25,
    },
  };
}

function inst(id: string, overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id,
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: overrides.assetDefinitionId ?? "sofa",
    positionMm: { x: 1000, y: 0, z: 1000 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCatalog(...defs: SceneAssetDefinition[]) {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return (id: string) => byId.get(id);
}

describe("validateSceneAssetPlacement", () => {
  it("returns [] when a lone sofa fits inside the room", () => {
    const issues = validateSceneAssetPlacement({
      instance: inst("i1", { positionMm: { x: 2000, y: 0, z: 2000 } }),
      definition: sofa(),
      room: ROOM,
      otherInstances: [],
      getDefinition: makeCatalog(sofa()),
    });
    expect(issues).toEqual([]);
  });

  it("emits room-bounds warnings when an asset pokes outside", () => {
    const issues = validateSceneAssetPlacement({
      instance: inst("i1", { positionMm: { x: 100, y: 0, z: 100 } }), // asset half-width 1000 → x<0
      definition: sofa(),
      room: ROOM,
      otherInstances: [],
      getDefinition: makeCatalog(sofa()),
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("OUTSIDE_LEFT");
    for (const i of issues) {
      expect(i.severity).toBe("warning");
      expect(i.source).toBe("scene");
    }
  });

  it("emits OVERLAPS_ASSET when two sofas share space, with targetInstanceId", () => {
    const a = inst("a", { positionMm: { x: 1500, y: 0, z: 1500 } });
    const b = inst("b", { positionMm: { x: 1600, y: 0, z: 1600 } });
    const issues = validateSceneAssetPlacement({
      instance: a,
      definition: sofa(),
      room: ROOM,
      otherInstances: [b],
      getDefinition: makeCatalog(sofa()),
    });
    const overlap = issues.find((i) => i.code === "OVERLAPS_ASSET");
    expect(overlap).toBeDefined();
    expect(overlap?.targetInstanceId).toBe("b");
  });

  it("does not report collision against an asset with collision.enabled=false", () => {
    const rugInst = inst("rug1", {
      assetDefinitionId: "rug",
      positionMm: { x: 1500, y: 0, z: 1500 },
    });
    const sofaInst = inst("sofa1", {
      assetDefinitionId: "sofa",
      positionMm: { x: 1500, y: 0, z: 1500 },
    });
    const issues = validateSceneAssetPlacement({
      instance: sofaInst,
      definition: sofa(),
      room: ROOM,
      otherInstances: [rugInst],
      getDefinition: makeCatalog(sofa(), rug()),
    });
    expect(issues.find((i) => i.code === "OVERLAPS_ASSET")).toBeUndefined();
  });

  it("emits CLEARANCE_VIOLATED when a second asset intrudes into the front clearance", () => {
    // Fridge at (1000, 0, 1000), facing +Z. Front clearance envelope extends to z=1000+350+900=2250.
    // Place a sofa at z=2000 (past the fridge front but within clearance zone).
    const fridgeInst = inst("fridge1", {
      assetDefinitionId: "fridge",
      positionMm: { x: 1000, y: 0, z: 1000 },
    });
    const sofaInst = inst("sofa1", {
      assetDefinitionId: "sofa",
      positionMm: { x: 1000, y: 0, z: 2000 },
    });
    const issues = validateSceneAssetPlacement({
      instance: fridgeInst,
      definition: fridge(),
      room: ROOM,
      otherInstances: [sofaInst],
      getDefinition: makeCatalog(fridge(), sofa()),
    });
    const clearance = issues.find((i) => i.code === "CLEARANCE_VIOLATED");
    expect(clearance).toBeDefined();
    expect(clearance?.targetInstanceId).toBe("sofa1");
  });

  it("only emits OVERLAPS_ASSET (not clearance) when the pair fully overlaps", () => {
    const a = inst("a", { assetDefinitionId: "fridge", positionMm: { x: 1000, y: 0, z: 1000 } });
    const b = inst("b", { assetDefinitionId: "fridge", positionMm: { x: 1050, y: 0, z: 1050 } });
    const issues = validateSceneAssetPlacement({
      instance: a,
      definition: fridge(),
      room: ROOM,
      otherInstances: [b],
      getDefinition: makeCatalog(fridge()),
    });
    const overlap = issues.filter((i) => i.code === "OVERLAPS_ASSET" && i.targetInstanceId === "b");
    const clearance = issues.filter((i) => i.code === "CLEARANCE_VIOLATED" && i.targetInstanceId === "b");
    expect(overlap).toHaveLength(1);
    expect(clearance).toHaveLength(0);
  });

  it("every emitted issue is tagged severity=warning source=scene", () => {
    const issues = validateSceneAssetPlacement({
      instance: inst("i1", { positionMm: { x: 100, y: -50, z: 100 } }),
      definition: sofa(),
      room: ROOM,
      otherInstances: [],
      getDefinition: makeCatalog(sofa()),
    });
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.severity).toBe("warning");
      expect(i.source).toBe("scene");
    }
  });

  it("skips the instance itself in otherInstances (self-collision noise prevention)", () => {
    const self = inst("i1", { positionMm: { x: 1500, y: 0, z: 1500 } });
    const issues = validateSceneAssetPlacement({
      instance: self,
      definition: sofa(),
      room: ROOM,
      otherInstances: [self],
      getDefinition: makeCatalog(sofa()),
    });
    expect(issues.find((i) => i.code === "OVERLAPS_ASSET")).toBeUndefined();
  });
});
