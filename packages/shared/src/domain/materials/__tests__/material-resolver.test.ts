import { describe, expect, it } from "vitest";
import { resolveSlotMaterial } from "../material-resolver";
import {
  emptyMaterialSelection,
  setCabinetSlot,
  setRoomSlot,
} from "../material-selection";

describe("resolveSlotMaterial — resolution chain", () => {
  it("uses the cabinet slot when set (highest priority)", () => {
    let s = emptyMaterialSelection();
    s = setRoomSlot(s, "floor", "floor-oak-gray");
    s = setCabinetSlot(s, "cab_1", "door", "painted-black");

    const r = resolveSlotMaterial(s, "cab_1", "door");
    expect(r.profile.id).toBe("painted-black");
    expect(r.origin).toBe("cabinet-slot");
    expect(r.sourceSlot).toBe("door");
  });

  it("falls back through the cabinet slot chain (drawerFront → door → cabinetExterior)", () => {
    let s = emptyMaterialSelection();
    s = setCabinetSlot(s, "cab_1", "cabinetExterior", "wood-walnut");

    const r = resolveSlotMaterial(s, "cab_1", "drawerFront");
    expect(r.profile.id).toBe("wood-walnut");
    expect(r.origin).toBe("cabinet-fallback-slot");
    expect(r.sourceSlot).toBe("cabinetExterior");
  });

  it("falls back to the room-level slot for floor/wall/backsplash/countertop", () => {
    let s = emptyMaterialSelection();
    s = setRoomSlot(s, "floor", "floor-walnut");

    const r = resolveSlotMaterial(s, null, "floor");
    expect(r.profile.id).toBe("floor-walnut");
    expect(r.origin).toBe("room-slot");
    expect(r.sourceSlot).toBe("floor");
  });

  it("countertop request from a cabinet mesh falls back to room countertop", () => {
    let s = emptyMaterialSelection();
    s = setRoomSlot(s, "countertop", "stone-quartz-gray");

    const r = resolveSlotMaterial(s, "cab_1", "countertop");
    expect(r.profile.id).toBe("stone-quartz-gray");
    expect(r.origin).toBe("room-slot");
  });

  it("returns the global category default when no user selection exists", () => {
    const s = emptyMaterialSelection();
    const wall = resolveSlotMaterial(s, null, "wall");
    expect(wall.origin).toBe("global-default");
    expect(wall.profile.category).toBe("wall");
    expect(wall.profile.id).toBe("wall-light-gray");
  });

  it("cabinet slot beats cabinet fallback beats room beats global", () => {
    const cabinetId = "cab_x";
    // Set every level for the door slot
    let s = emptyMaterialSelection();
    // 4 - global default (implicit)
    // 3 - room level (rooms don't have a door slot but backsplash does)
    // 2 - cabinet fallback slot (cabinetExterior)
    s = setCabinetSlot(s, cabinetId, "cabinetExterior", "wood-maple");
    // 1 - cabinet-level door
    s = setCabinetSlot(s, cabinetId, "door", "painted-navy");

    const r = resolveSlotMaterial(s, cabinetId, "door");
    expect(r.profile.id).toBe("painted-navy");
    expect(r.origin).toBe("cabinet-slot");

    // Remove the top level; fallback slot should win
    const r2 = resolveSlotMaterial(
      { ...s, cabinets: { [cabinetId]: { cabinetExterior: "wood-maple" } } },
      cabinetId,
      "door",
    );
    expect(r2.profile.id).toBe("wood-maple");
    expect(r2.origin).toBe("cabinet-fallback-slot");
  });

  it("cabinetInterior falls back to cabinetExterior when unset", () => {
    let s = emptyMaterialSelection();
    s = setCabinetSlot(s, "cab_1", "cabinetExterior", "painted-black");
    const r = resolveSlotMaterial(s, "cab_1", "cabinetInterior");
    expect(r.profile.id).toBe("painted-black");
    expect(r.origin).toBe("cabinet-fallback-slot");
  });

  it("never returns undefined for any MaterialSlot with the empty selection", () => {
    const s = emptyMaterialSelection();
    const slots = [
      "cabinetExterior",
      "cabinetInterior",
      "door",
      "drawerFront",
      "shelf",
      "toeKick",
      "faceFrame",
      "finishedEnd",
      "countertop",
      "backsplash",
      "floor",
      "wall",
      "hardware",
      "appliance",
    ] as const;
    for (const slot of slots) {
      const r = resolveSlotMaterial(s, "cab_1", slot);
      expect(r.profile, `slot ${slot} should always resolve to a profile`).toBeDefined();
    }
  });

  it("resolution is pure (does not mutate the selection)", () => {
    let s = emptyMaterialSelection();
    s = setRoomSlot(s, "floor", "floor-oak-gray");
    const before = JSON.parse(JSON.stringify(s));
    resolveSlotMaterial(s, "cab_1", "floor");
    expect(s).toEqual(before);
  });
});
