"use client";

import { useMaterialsStore } from "@/store/materials";
import { useSlotMaterial } from "@/lib/render/materials";
import type { Cabinet, Room } from "@woodcraft/shared";

// The RoomShell renders the enclosing walls, floor, and (when a base
// cabinet is present in the room) a backsplash strip. It replaces the
// previous "cabinets floating over infinite grid" appearance with an
// actual room enclosure so material selections have surfaces to land on.
//
// Dimensions come from the currently-selected Room. Wall/floor materials
// come from the material selection via the shared resolver.

interface Props {
  room: Room;
  cabinets: Cabinet[];
}

const WALL_THICKNESS_M = 0.05; // 50 mm — thin enough to feel like drywall
const FLOOR_THICKNESS_M = 0.02;

/** Height in mm above the floor where the backsplash sits. Matches a
 *  typical kitchen counter top. */
const COUNTER_HEIGHT_MM = 870;
const BACKSPLASH_HEIGHT_MM = 500;

export function RoomShell({ room, cabinets }: Props) {
  const selection = useMaterialsStore((s) => s.selection);

  const wMm = Number(room.width);
  const hMm = Number(room.height);
  const dMm = Number(room.depth);

  const wM = wMm / 1000;
  const hM = hMm / 1000;
  const dM = dMm / 1000;

  const floorMat = useSlotMaterial(selection, null, "floor", {
    face: { widthMm: wMm, heightMm: dMm },
  });
  const wallBackMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: wMm, heightMm: hMm },
  });
  const wallLeftMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: dMm, heightMm: hMm },
  });
  const wallRightMat = useSlotMaterial(selection, null, "wall", {
    face: { widthMm: dMm, heightMm: hMm },
  });

  // Only render the backsplash when there's at least one base cabinet.
  const hasBaseCabinet = cabinets.some((c) => {
    if (c.type === "base" || c.type === "sink_base" || c.type === "drawer_base") return true;
    return false;
  });
  const backsplashMat = useSlotMaterial(selection, null, "backsplash", {
    face: { widthMm: wMm, heightMm: BACKSPLASH_HEIGHT_MM },
  });

  return (
    <group>
      {/* Floor — thin slab centered under the room, top face at y=0 */}
      <mesh
        position={[wM / 2, -FLOOR_THICKNESS_M / 2, dM / 2]}
        receiveShadow
        material={floorMat}
      >
        <boxGeometry args={[wM, FLOOR_THICKNESS_M, dM]} />
      </mesh>

      {/* Back wall — sits behind the room at z = dM */}
      <mesh
        position={[wM / 2, hM / 2, dM + WALL_THICKNESS_M / 2]}
        receiveShadow
        material={wallBackMat}
      >
        <boxGeometry args={[wM, hM, WALL_THICKNESS_M]} />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-WALL_THICKNESS_M / 2, hM / 2, dM / 2]}
        receiveShadow
        material={wallLeftMat}
      >
        <boxGeometry args={[WALL_THICKNESS_M, hM, dM]} />
      </mesh>

      {/* Right wall */}
      <mesh
        position={[wM + WALL_THICKNESS_M / 2, hM / 2, dM / 2]}
        receiveShadow
        material={wallRightMat}
      >
        <boxGeometry args={[WALL_THICKNESS_M, hM, dM]} />
      </mesh>

      {/* Backsplash — thin band on back wall above the counter line */}
      {hasBaseCabinet && (
        <mesh
          position={[
            wM / 2,
            COUNTER_HEIGHT_MM / 1000 + BACKSPLASH_HEIGHT_MM / 2000,
            dM + WALL_THICKNESS_M + 0.002, // 2 mm proud of back wall to avoid z-fighting
          ]}
          receiveShadow
          material={backsplashMat}
        >
          <boxGeometry
            args={[wM * 0.98, BACKSPLASH_HEIGHT_MM / 1000, 0.006]}
          />
        </mesh>
      )}
    </group>
  );
}
