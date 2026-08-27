import { describe, expect, it } from "vitest";
import {
  LEGACY_WALL_IDS,
  LEGACY_WALL_THICKNESS_MM,
  deriveDefaultRoomArchitecture,
} from "../legacy-adapter";
import { roomArchitectureSchema } from "../schema";

const ROOM = { width: 4800, height: 2400, depth: 3600 };

describe("deriveDefaultRoomArchitecture", () => {
  it("produces exactly 4 walls in counter-clockwise order (south, east, north, west)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(arch.walls).toHaveLength(4);
    expect(arch.walls.map((w) => w.id)).toEqual([
      LEGACY_WALL_IDS.south,
      LEGACY_WALL_IDS.east,
      LEGACY_WALL_IDS.north,
      LEGACY_WALL_IDS.west,
    ]);
  });

  it("walls form a closed loop (each end matches the next start)", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    for (let i = 0; i < arch.walls.length; i++) {
      const cur = arch.walls[i]!;
      const next = arch.walls[(i + 1) % arch.walls.length]!;
      expect(next.startMm).toEqual(cur.endMm);
    }
  });

  it("south wall runs from (0,0) to (W,0) along the +X axis", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const south = arch.walls.find((w) => w.id === LEGACY_WALL_IDS.south)!;
    expect(south.startMm).toEqual({ x: 0, z: 0 });
    expect(south.endMm).toEqual({ x: ROOM.width, z: 0 });
  });

  it("every wall carries the room's height + default thickness with no openings", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    for (const wall of arch.walls) {
      expect(wall.heightMm).toBe(ROOM.height);
      expect(wall.thicknessMm).toBe(LEGACY_WALL_THICKNESS_MM);
      expect(wall.openings).toEqual([]);
    }
  });

  it("parses through the Zod schema without errors", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    expect(() => roomArchitectureSchema.parse(arch)).not.toThrow();
  });

  it("accepts Decimal-shaped inputs (Prisma Decimal via Number(...))", () => {
    // Prisma Decimal serializes via Number() at the API boundary — this
    // helper takes plain numbers so we accept those directly.
    const arch = deriveDefaultRoomArchitecture({ width: 5000, height: 2500, depth: 4000 });
    expect(arch.walls[0]?.endMm.x).toBe(5000);
    expect(arch.walls[2]?.startMm.z).toBe(4000);
  });
});
