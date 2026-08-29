import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../../sceneAssets/scene-asset-definition";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";
import {
  resolveWallAttachedSceneAssetTransform,
  resolveWithWall,
} from "../wall-attachment-resolver";

// Legacy wall order: south / east / north / west
//   south:  (0,0) → (W,0)
//   east:   (W,0) → (W,D)
//   north:  (W,D) → (0,D)
//   west:   (0,D) → (0,0)
// Inward normal points into room; wall inner face lies on architecture
// design line (renderer offsets outward by halfThickness separately).

const ROOM = { width: 4000, height: 2400, depth: 3000 };

const SOFA: Pick<SceneAssetDefinition, "dimensionsMm"> = {
  dimensionsMm: { widthMm: 800, heightMm: 900, depthMm: 400 },
};

const HALF_DEPTH = 200;

function approx(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

describe("resolveWallAttachedSceneAssetTransform", () => {
  it("returns null for a wallId not in the architecture", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(
      resolveWallAttachedSceneAssetTransform({
        attachment: {
          wallId: "wall:does-not-exist",
          localPositionMm: { x: 0, y: 0, z: 0 },
        },
        definition: SOFA,
        architecture: arch,
      }),
    ).toBeNull();
  });

  it("south wall: centers along wall, back flush at z=0, faces +Z (rotationY=180°)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWallAttachedSceneAssetTransform({
      attachment: {
        wallId: "wall:south",
        localPositionMm: { x: 2000, y: 0, z: 0 },
      },
      definition: SOFA,
      architecture: arch,
    });
    expect(r).not.toBeNull();
    expect(approx(r!.positionMm.x, 2000)).toBe(true);
    // wall face at z=0 → asset center at z = halfDepth (into room = +Z)
    expect(approx(r!.positionMm.z, HALF_DEPTH)).toBe(true);
    expect(approx(r!.positionMm.y, 0)).toBe(true);
    expect(approx(r!.rotationDeg.y, 180)).toBe(true);
  });

  it("east wall: local x=1500 along wall, faces -X (rotationY=90°)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:east",
        localPositionMm: { x: 1500, y: 0, z: 0 },
      },
      definition: SOFA,
      wall: arch.walls.find((w) => w.id === "wall:east")!,
    });
    // East wall: start (W,0)=(4000,0), tangent = (0,+1). Local x=1500
    // → world (4000, ?, 1500). Inward normal = (-1, 0), so surface
    // offset moves x inward: 4000 - halfDepth.
    expect(approx(r.positionMm.x, ROOM.width - HALF_DEPTH)).toBe(true);
    expect(approx(r.positionMm.z, 1500)).toBe(true);
    // angleRad for east wall = atan2(1, 0) = 90°. rotationY = 180 - 90 = 90°.
    expect(approx(r.rotationDeg.y, 90)).toBe(true);
  });

  it("north wall: faces -Z (rotationY=0°) and offsets inward at -Z", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:north",
        localPositionMm: { x: 1000, y: 0, z: 0 },
      },
      definition: SOFA,
      wall: arch.walls.find((w) => w.id === "wall:north")!,
    });
    // North wall: start (W,D)=(4000,3000), tangent=(-1,0). Local x=1000
    // → world (3000, ?, 3000). Inward normal = (0, -1); +halfDepth
    // offset moves z inward by -halfDepth.
    expect(approx(r.positionMm.x, ROOM.width - 1000)).toBe(true);
    expect(approx(r.positionMm.z, ROOM.depth - HALF_DEPTH)).toBe(true);
    // angleRad for north wall = atan2(0, -1) = 180°. rotationY = 180 - 180 = 0°.
    expect(approx(r.rotationDeg.y, 0)).toBe(true);
  });

  it("west wall: faces +X (rotationY=270°)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:west",
        localPositionMm: { x: 1500, y: 0, z: 0 },
      },
      definition: SOFA,
      wall: arch.walls.find((w) => w.id === "wall:west")!,
    });
    // West wall: start (0,D)=(0,3000), tangent=(0,-1). Local x=1500
    // → world (0, ?, 3000-1500)=(0, ?, 1500). Inward normal = (+1, 0);
    // offset moves x inward by +halfDepth.
    expect(approx(r.positionMm.x, HALF_DEPTH)).toBe(true);
    expect(approx(r.positionMm.z, ROOM.depth - 1500)).toBe(true);
    // angleRad for west wall = atan2(-1, 0) = -90°. rotationY = 180 - (-90) = 270°.
    expect(approx(r.rotationDeg.y, 270)).toBe(true);
  });

  it("respects a positive surface offset (zMm) — asset pushed further into room", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:south",
        localPositionMm: { x: 2000, y: 0, z: 50 },
      },
      definition: SOFA,
      wall: arch.walls.find((w) => w.id === "wall:south")!,
    });
    // South inward normal = (0, +1). z_local=50 + halfDepth pushes
    // asset center to z = 50 + 200 = 250.
    expect(approx(r.positionMm.z, 250)).toBe(true);
  });

  it("preserves wall-local Y (height above floor)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:south",
        localPositionMm: { x: 500, y: 1400, z: 0 },
      },
      definition: SOFA,
      wall: arch.walls.find((w) => w.id === "wall:south")!,
    });
    expect(approx(r.positionMm.y, 1400)).toBe(true);
  });

  it("handles a definition without depthMm (defaults halfDepth to 0)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const r = resolveWithWall({
      attachment: {
        wallId: "wall:south",
        localPositionMm: { x: 100, y: 0, z: 0 },
      },
      definition: { dimensionsMm: undefined as unknown as SceneAssetDefinition["dimensionsMm"] },
      wall: arch.walls.find((w) => w.id === "wall:south")!,
    });
    expect(approx(r.positionMm.z, 0)).toBe(true);
  });
});
