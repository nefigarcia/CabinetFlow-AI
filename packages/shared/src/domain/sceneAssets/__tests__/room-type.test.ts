import { describe, expect, it } from "vitest";
import type { Room } from "../../../types/project";
import {
  getRoomType,
  normalizeRoomType,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
} from "../room-type";

function makeRoom(metadata: Record<string, unknown> | null): Room {
  return {
    id: "room_1",
    projectId: "proj_1",
    orgId: "org_1",
    name: "Room",
    width: 4800,
    height: 2400,
    depth: 3600,
    metadata,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ROOM_TYPES", () => {
  it("has a label for every declared type", () => {
    for (const type of ROOM_TYPES) {
      expect(ROOM_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ROOM_TYPES).size).toBe(ROOM_TYPES.length);
  });
});

describe("normalizeRoomType", () => {
  it("passes canonical values through", () => {
    for (const type of ROOM_TYPES) {
      expect(normalizeRoomType(type)).toBe(type);
    }
  });

  it("lowercases and replaces spaces with underscore", () => {
    expect(normalizeRoomType("Kitchen")).toBe("kitchen");
    expect(normalizeRoomType("Living Room")).toBe("living_room");
    expect(normalizeRoomType("BEDROOM")).toBe("bedroom");
    expect(normalizeRoomType("  living   room  ")).toBe("living_room");
  });

  it("resolves documented aliases", () => {
    expect(normalizeRoomType("primary bedroom")).toBe("bedroom");
    expect(normalizeRoomType("master bedroom")).toBe("bedroom");
    expect(normalizeRoomType("primary bathroom")).toBe("bathroom");
    expect(normalizeRoomType("powder room")).toBe("bathroom");
    expect(normalizeRoomType("wc")).toBe("bathroom");
    expect(normalizeRoomType("utility")).toBe("laundry");
    expect(normalizeRoomType("utility room")).toBe("laundry");
    expect(normalizeRoomType("walk in closet")).toBe("closet");
    expect(normalizeRoomType("wardrobe")).toBe("closet");
    expect(normalizeRoomType("study")).toBe("office");
    expect(normalizeRoomType("home office")).toBe("office");
    expect(normalizeRoomType("family room")).toBe("living_room");
    expect(normalizeRoomType("great room")).toBe("living_room");
    expect(normalizeRoomType("living")).toBe("living_room");
  });

  it("falls back to 'custom' for unknown / empty / non-string input", () => {
    expect(normalizeRoomType("garage")).toBe("custom");
    expect(normalizeRoomType("")).toBe("custom");
    expect(normalizeRoomType("   ")).toBe("custom");
    expect(normalizeRoomType(undefined)).toBe("custom");
    expect(normalizeRoomType(null)).toBe("custom");
    expect(normalizeRoomType(42)).toBe("custom");
    expect(normalizeRoomType({})).toBe("custom");
    expect(normalizeRoomType(["kitchen"])).toBe("custom");
  });
});

describe("getRoomType", () => {
  it("reads Room.metadata.roomType", () => {
    expect(getRoomType(makeRoom({ roomType: "kitchen" }))).toBe("kitchen");
    expect(getRoomType(makeRoom({ roomType: "Living Room" }))).toBe("living_room");
  });

  it("falls back to 'custom' when metadata is null", () => {
    expect(getRoomType(makeRoom(null))).toBe("custom");
  });

  it("falls back to 'custom' when metadata has no roomType key", () => {
    expect(getRoomType(makeRoom({}))).toBe("custom");
    expect(getRoomType(makeRoom({ otherKey: "x" }))).toBe("custom");
  });

  it("falls back to 'custom' when roomType is not a string", () => {
    expect(getRoomType(makeRoom({ roomType: 42 }))).toBe("custom");
    expect(getRoomType(makeRoom({ roomType: {} }))).toBe("custom");
  });

  it("falls back to 'custom' for null / undefined room", () => {
    expect(getRoomType(null)).toBe("custom");
    expect(getRoomType(undefined)).toBe("custom");
  });

  it("preserves alias behavior end-to-end (metadata alias → canonical)", () => {
    expect(getRoomType(makeRoom({ roomType: "primary bedroom" }))).toBe("bedroom");
    expect(getRoomType(makeRoom({ roomType: "utility" }))).toBe("laundry");
  });
});
