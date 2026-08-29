import { z } from "zod";
import type { Cabinet, CabinetType } from "../../types/cabinet";
import type { WallDefinition, RoomArchitecture } from "../architecture/types";
import { getWallFrame, wallLocalToWorld } from "../architecture/wall-math";

// Cabinet wall attachment adapter.
//
// The Cabinet DB row stores world posX/posY/posZ (bottom-back-left corner
// of the cabinet's world AABB). We layer wall-attached semantics ON TOP of
// that using the `parameters` JSON bag — which already has an
// `[key: string]: unknown` index type, so nothing about the DB schema
// changes.
//
// Persisted shape (inside `Cabinet.parameters.wallPlacement`):
//   {
//     wallId: string,
//     offsetMm: number,             // wall-local X of the cabinet's LEFT edge
//     baseElevationMm: number,      // wall-local Y (bottom of cabinet above floor)
//     facing: "into-room",          // reserved — cabinets always face into the room
//   }
//
// posX/posY/posZ remain authoritative for rendering + manufacturing (the
// compiler is unchanged). The adapter derives the correct world corner
// from the placement, so writes go through `computeCabinetWorldPosition`.
//
// A cabinet without `parameters.wallPlacement` is a FREE cabinet — legacy
// behavior, world position is authoritative on its own.

export const CABINET_WALL_PLACEMENT_KEY = "wallPlacement" as const;

export type CabinetFacing = "into-room";

export interface CabinetWallPlacement {
  wallId: string;
  /** Wall-local X — offset from wall start to the cabinet's LEFT edge (mm). */
  offsetMm: number;
  /** Wall-local Y — bottom of cabinet above floor (mm). Base cabinets = 0;
   *  wall cabinets = install height (e.g. 1400 mm). */
  baseElevationMm: number;
  facing: CabinetFacing;
}

export const cabinetWallPlacementSchema: z.ZodType<CabinetWallPlacement> = z.object({
  wallId: z.string().min(1),
  offsetMm: z.number(),
  baseElevationMm: z.number(),
  facing: z.literal("into-room"),
});

/** Reads the wall placement out of a cabinet's parameters bag. Returns
 *  null when the cabinet is free (never attached) or when the persisted
 *  shape is malformed. Never throws. */
export function getCabinetWallPlacement(
  cabinet: Pick<Cabinet, "parameters">,
): CabinetWallPlacement | null {
  const raw = cabinet.parameters?.[CABINET_WALL_PLACEMENT_KEY];
  if (!raw || typeof raw !== "object") return null;
  const parsed = cabinetWallPlacementSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** True when the cabinet has a valid wall attachment. */
export function isCabinetWallAttached(
  cabinet: Pick<Cabinet, "parameters">,
): boolean {
  return getCabinetWallPlacement(cabinet) !== null;
}

/** Merges a wall placement into an existing parameters bag, returning a
 *  fresh bag (never mutates input). Pass `null` to clear the attachment. */
export function withCabinetWallPlacement(
  parameters: Cabinet["parameters"] | undefined,
  placement: CabinetWallPlacement | null,
): Cabinet["parameters"] {
  const base: Record<string, unknown> = { ...(parameters ?? {}) };
  if (placement === null) {
    delete base[CABINET_WALL_PLACEMENT_KEY];
  } else {
    base[CABINET_WALL_PLACEMENT_KEY] = placement;
  }
  return base as Cabinet["parameters"];
}

// ─── Cabinet-type policy ────────────────────────────────────────────────

/** Default install height (mm) for a wall cabinet's bottom above floor.
 *  Matches the North-American residential norm; overridable via the
 *  cabinet's own baseElevationMm on placement. */
export const DEFAULT_WALL_CABINET_ELEVATION_MM = 1400;

/** True when the cabinet type sits on the floor. */
export function isFloorMountedCabinetType(type: CabinetType): boolean {
  return (
    type === "base" ||
    type === "tall" ||
    type === "corner" ||
    type === "drawer_base" ||
    type === "sink_base" ||
    type === "island"
  );
}

export function isWallMountedCabinetType(type: CabinetType): boolean {
  return type === "wall";
}

/** Default base elevation for a given cabinet type. */
export function defaultBaseElevationMm(type: CabinetType): number {
  return isFloorMountedCabinetType(type) ? 0 : DEFAULT_WALL_CABINET_ELEVATION_MM;
}

// ─── World-position resolver ────────────────────────────────────────────

/**
 * Given a wall placement + cabinet size + wall, returns the world AABB
 * MIN corner (posX/posY/posZ semantics). The min corner sits at:
 *   · wall-local X = placement.offsetMm  (cabinet's left edge)
 *   · wall-local Y = placement.baseElevationMm  (cabinet's bottom)
 *   · wall-local Z = 0  (cabinet's back flush with the wall inner face)
 *
 * Cabinet depth extends INTO the room (positive wall-local Z is the
 * inward normal). The returned min corner is the corner CLOSEST to the
 * wall start / floor / wall face — matches the existing "MIN corner
 * (bottom-back-left)" contract used by cabinet-bridge.ts.
 */
export function computeCabinetWorldPosition(input: {
  placement: CabinetWallPlacement;
  wall: WallDefinition;
  widthMm: number;
  depthMm: number;
}): { posX: number; posY: number; posZ: number } {
  const frame = getWallFrame(input.wall);
  // Min corner is at (offset, elevation, 0) in wall-local coords.
  // Depth is measured along the wall-inward normal.
  const world = wallLocalToWorld(frame, {
    xMm: input.placement.offsetMm,
    yMm: input.placement.baseElevationMm,
    zMm: 0,
  });
  return { posX: world.x, posY: world.y, posZ: world.z };
}

/** Resolves the world position from a placement, looking the wall up in
 *  the architecture. Returns null when the wall id is unknown. */
export function resolveCabinetWorldPosition(input: {
  placement: CabinetWallPlacement;
  architecture: RoomArchitecture;
  widthMm: number;
  depthMm: number;
}): { posX: number; posY: number; posZ: number } | null {
  const wall = input.architecture.walls.find((w) => w.id === input.placement.wallId);
  if (!wall) return null;
  return computeCabinetWorldPosition({
    placement: input.placement,
    wall,
    widthMm: input.widthMm,
    depthMm: input.depthMm,
  });
}

/**
 * Given a legacy free cabinet (world pos only), guesses the closest wall
 * from the architecture by picking the wall whose inward face the
 * cabinet's back plane is closest to. Returns null when no wall is close
 * enough (> 500 mm). Intended for a one-time "attach existing cabinets to
 * their nearest wall" convenience — NOT called automatically on every
 * render; the UI opts in explicitly.
 */
export function inferNearestWallForCabinet(input: {
  cabinet: Pick<Cabinet, "posX" | "posY" | "posZ" | "width" | "depth">;
  architecture: RoomArchitecture;
  toleranceMm?: number;
}): { wallId: string; offsetMm: number; baseElevationMm: number } | null {
  const TOL = input.toleranceMm ?? 500;
  const c = input.cabinet;
  // Sample the cabinet's back-center point (min-corner + width/2 on X, 0 on Z).
  const backCenter = {
    x: c.posX + c.width / 2,
    z: c.posZ,
  };
  let best: { wallId: string; distMm: number; offsetMm: number } | null = null;
  for (const w of input.architecture.walls) {
    const frame = getWallFrame(w);
    // Project back-center onto the wall's tangent to get offsetMm.
    const dx = backCenter.x - w.startMm.x;
    const dz = backCenter.z - w.startMm.z;
    const alongMm = dx * frame.tangent.x + dz * frame.tangent.z;
    if (alongMm < 0 || alongMm > frame.lengthMm) continue;
    // Perpendicular distance to the wall centerline in world XZ.
    const normalDistMm = Math.abs(dx * frame.normal.x + dz * frame.normal.z);
    if (best == null || normalDistMm < best.distMm) {
      best = { wallId: w.id, distMm: normalDistMm, offsetMm: alongMm };
    }
  }
  if (!best || best.distMm > TOL) return null;
  return { wallId: best.wallId, offsetMm: best.offsetMm, baseElevationMm: c.posY };
}
