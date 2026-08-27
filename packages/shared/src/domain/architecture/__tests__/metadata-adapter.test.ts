import { describe, expect, it } from "vitest";
import { getRoomArchitecture, withRoomArchitecture } from "../metadata-adapter";
import { deriveDefaultRoomArchitecture } from "../legacy-adapter";
import { roomArchitectureSchema } from "../schema";

const ROOM = { width: 4800, height: 2400, depth: 3600, metadata: null };

describe("getRoomArchitecture", () => {
  it("falls back to legacy derived architecture when metadata is null", () => {
    const arch = getRoomArchitecture(ROOM);
    expect(arch).toEqual(deriveDefaultRoomArchitecture(ROOM));
  });

  it("falls back to legacy derived architecture when metadata has no architecture key", () => {
    const arch = getRoomArchitecture({ ...ROOM, metadata: { roomType: "kitchen" } });
    expect(arch.walls).toHaveLength(4);
  });

  it("returns stored architecture when present + valid", () => {
    const custom = deriveDefaultRoomArchitecture(ROOM);
    custom.walls[0]!.openings.push({
      id: "d1",
      type: "door",
      offsetMm: 800,
      widthMm: 900,
      heightMm: 2100,
    });
    const room = { ...ROOM, metadata: { architecture: custom } };
    expect(getRoomArchitecture(room).walls[0]?.openings).toHaveLength(1);
  });

  it("falls back to legacy when stored architecture is malformed", () => {
    const room = { ...ROOM, metadata: { architecture: { schemaVersion: "9.9" } } };
    const arch = getRoomArchitecture(room);
    // Legacy derived arch, not the malformed one.
    expect(arch.walls).toHaveLength(4);
    expect(() => roomArchitectureSchema.parse(arch)).not.toThrow();
  });
});

describe("withRoomArchitecture", () => {
  it("adds architecture to a fresh metadata object", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const merged = withRoomArchitecture(null, arch);
    expect(merged.architecture).toEqual(arch);
  });

  it("preserves other metadata keys (roomType) on merge", () => {
    const arch = deriveDefaultRoomArchitecture(ROOM);
    const merged = withRoomArchitecture({ roomType: "kitchen", other: 1 }, arch);
    expect(merged.roomType).toBe("kitchen");
    expect(merged.other).toBe(1);
    expect(merged.architecture).toEqual(arch);
  });

  it("overwrites an existing architecture key without touching siblings", () => {
    const old = deriveDefaultRoomArchitecture(ROOM);
    const fresh = deriveDefaultRoomArchitecture({ width: 6000, height: 3000, depth: 4000 });
    const merged = withRoomArchitecture(
      { roomType: "kitchen", architecture: old },
      fresh,
    );
    expect(merged.roomType).toBe("kitchen");
    expect(merged.architecture).toEqual(fresh);
  });
});
