import { describe, expect, it } from "vitest";
import {
  clearCabinetSelections,
  emptyMaterialSelection,
  MATERIAL_SELECTION_SCHEMA_VERSION,
  materialSelectionSchema,
  readCabinetSlot,
  readRoomSlot,
  setCabinetSlot,
  setRoomSlot,
} from "../material-selection";

describe("MaterialSelection — immutable setters + serialization", () => {
  it("emptyMaterialSelection produces a valid, empty selection", () => {
    const empty = emptyMaterialSelection();
    expect(empty.schemaVersion).toBe(MATERIAL_SELECTION_SCHEMA_VERSION);
    expect(empty.room).toEqual({});
    expect(empty.cabinets).toEqual({});
    expect(() => materialSelectionSchema.parse(empty)).not.toThrow();
  });

  it("setRoomSlot returns a new object and preserves the original", () => {
    const before = emptyMaterialSelection();
    const after = setRoomSlot(before, "floor", "floor-oak-gray");
    expect(before.room.floor).toBeUndefined();
    expect(after.room.floor).toBe("floor-oak-gray");
    expect(after).not.toBe(before);
  });

  it("setRoomSlot with undefined clears the slot", () => {
    const withFloor = setRoomSlot(emptyMaterialSelection(), "floor", "floor-oak-gray");
    const cleared = setRoomSlot(withFloor, "floor", undefined);
    expect(cleared.room.floor).toBeUndefined();
  });

  it("setCabinetSlot creates and updates cabinet slots immutably", () => {
    const s0 = emptyMaterialSelection();
    const s1 = setCabinetSlot(s0, "cab_1", "cabinetExterior", "wood-white-oak");
    const s2 = setCabinetSlot(s1, "cab_1", "door", "painted-white");
    expect(s0.cabinets).toEqual({});
    expect(s1.cabinets["cab_1"]).toEqual({ cabinetExterior: "wood-white-oak" });
    expect(s2.cabinets["cab_1"]).toEqual({
      cabinetExterior: "wood-white-oak",
      door: "painted-white",
    });
  });

  it("setCabinetSlot with undefined clears the slot; removes the cabinet if empty", () => {
    let s = setCabinetSlot(emptyMaterialSelection(), "cab_1", "door", "painted-white");
    s = setCabinetSlot(s, "cab_1", "door", undefined);
    expect(s.cabinets["cab_1"]).toBeUndefined();
  });

  it("readCabinetSlot returns the slot value or undefined", () => {
    const s = setCabinetSlot(emptyMaterialSelection(), "cab_1", "hardware", "metal-stainless");
    expect(readCabinetSlot(s, "cab_1", "hardware")).toBe("metal-stainless");
    expect(readCabinetSlot(s, "cab_1", "door")).toBeUndefined();
    expect(readCabinetSlot(s, "cab_missing", "hardware")).toBeUndefined();
  });

  it("readRoomSlot returns the slot value or undefined", () => {
    const s = setRoomSlot(emptyMaterialSelection(), "wall", "wall-light-gray");
    expect(readRoomSlot(s, "wall")).toBe("wall-light-gray");
    expect(readRoomSlot(s, "floor")).toBeUndefined();
  });

  it("clearCabinetSelections removes all slots for a cabinet", () => {
    let s = emptyMaterialSelection();
    s = setCabinetSlot(s, "cab_1", "cabinetExterior", "wood-walnut");
    s = setCabinetSlot(s, "cab_1", "door", "painted-white");
    s = setCabinetSlot(s, "cab_2", "cabinetExterior", "wood-maple");
    const after = clearCabinetSelections(s, "cab_1");
    expect(after.cabinets["cab_1"]).toBeUndefined();
    expect(after.cabinets["cab_2"]).toBeDefined();
  });

  it("round-trips through JSON without losing information", () => {
    let s = emptyMaterialSelection();
    s = setRoomSlot(s, "floor", "floor-oak-gray");
    s = setRoomSlot(s, "wall", "wall-dark-gray");
    s = setCabinetSlot(s, "cab_1", "cabinetExterior", "wood-white-oak");
    s = setCabinetSlot(s, "cab_1", "hardware", "metal-matte-black");

    const restored = materialSelectionSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(restored).toEqual(s);
  });

  it("rejects a selection with the wrong schemaVersion", () => {
    const bad = { ...emptyMaterialSelection(), schemaVersion: "9.9" };
    expect(() => materialSelectionSchema.parse(bad)).toThrow();
  });
});
