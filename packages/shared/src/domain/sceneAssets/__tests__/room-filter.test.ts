import { describe, expect, it } from "vitest";
import type { SceneAssetInstance } from "../scene-asset-instance";
import { filterInstancesForRoom } from "../room-filter";

function inst(id: string, roomId: string): SceneAssetInstance {
  return {
    id,
    orgId: "org_1",
    roomId,
    assetDefinitionId: "sofa-3seat-generic",
    positionMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("filterInstancesForRoom", () => {
  const all = [inst("a", "roomA"), inst("b", "roomB"), inst("c", "roomA")];

  it("returns only instances matching the given roomId", () => {
    expect(filterInstancesForRoom(all, "roomA").map((i) => i.id)).toEqual(["a", "c"]);
    expect(filterInstancesForRoom(all, "roomB").map((i) => i.id)).toEqual(["b"]);
  });

  it("returns an empty array when roomId is null", () => {
    expect(filterInstancesForRoom(all, null)).toEqual([]);
  });

  it("returns an empty array when roomId is undefined", () => {
    expect(filterInstancesForRoom(all, undefined)).toEqual([]);
  });

  it("returns an empty array when the roomId matches nothing", () => {
    expect(filterInstancesForRoom(all, "does-not-exist")).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const list = [inst("a", "roomA"), inst("b", "roomB")];
    filterInstancesForRoom(list, "roomA");
    expect(list).toHaveLength(2);
  });

  it("handles an empty input list", () => {
    expect(filterInstancesForRoom([], "roomA")).toEqual([]);
  });
});
