import { describe, expect, it } from "vitest";
import type { SceneAssetInstance } from "../scene-asset-instance";
import {
  addInstance,
  clearInstances,
  removeInstance,
  updateInstance,
} from "../instance-reducers";

function makeInstance(overrides: Partial<SceneAssetInstance> = {}): SceneAssetInstance {
  return {
    id: "inst_a",
    orgId: "org_1",
    roomId: "room_1",
    assetDefinitionId: "sofa-3seat-generic",
    positionMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("addInstance", () => {
  it("appends to the list", () => {
    const list = [makeInstance({ id: "a" })];
    const out = addInstance(list, makeInstance({ id: "b" }));
    expect(out).toHaveLength(2);
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns a new array (does not mutate)", () => {
    const list: SceneAssetInstance[] = [];
    const out = addInstance(list, makeInstance({ id: "a" }));
    expect(out).not.toBe(list);
    expect(list).toHaveLength(0);
  });
});

describe("removeInstance", () => {
  it("drops the instance with the matching id", () => {
    const list = [makeInstance({ id: "a" }), makeInstance({ id: "b" })];
    expect(removeInstance(list, "a")).toEqual([makeInstance({ id: "b" })]);
  });

  it("is a no-op when the id is not present", () => {
    const list = [makeInstance({ id: "a" })];
    expect(removeInstance(list, "does-not-exist")).toEqual(list);
  });

  it("returns a new array even on no-op", () => {
    const list = [makeInstance({ id: "a" })];
    const out = removeInstance(list, "nope");
    expect(out).not.toBe(list);
  });
});

describe("updateInstance", () => {
  it("applies a partial patch to the matching instance", () => {
    const list = [makeInstance({ id: "a" })];
    const out = updateInstance(
      list,
      "a",
      { positionMm: { x: 100, y: 0, z: 200 }, visible: false },
      () => "2026-06-01T00:00:00.000Z",
    );
    expect(out[0]!.positionMm).toEqual({ x: 100, y: 0, z: 200 });
    expect(out[0]!.visible).toBe(false);
  });

  it("refreshes updatedAt from the provided clock", () => {
    const list = [makeInstance({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" })];
    const out = updateInstance(list, "a", { visible: false }, () => "2026-08-26T00:00:00.000Z");
    expect(out[0]!.updatedAt).toBe("2026-08-26T00:00:00.000Z");
  });

  it("leaves non-matching instances untouched", () => {
    const b = makeInstance({ id: "b", visible: true });
    const list = [makeInstance({ id: "a" }), b];
    const out = updateInstance(list, "a", { visible: false }, () => "x");
    expect(out[1]).toEqual(b);
  });

  it("no-op when the id is not found", () => {
    const list = [makeInstance({ id: "a" })];
    const out = updateInstance(list, "nope", { visible: false }, () => "x");
    expect(out).toEqual(list);
  });

  it("does not mutate the input list", () => {
    const list = [makeInstance({ id: "a", visible: true })];
    updateInstance(list, "a", { visible: false }, () => "x");
    expect(list[0]!.visible).toBe(true);
  });
});

describe("clearInstances", () => {
  it("returns an empty array", () => {
    expect(clearInstances()).toEqual([]);
  });
});
