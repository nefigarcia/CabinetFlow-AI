import { describe, expect, it } from "vitest";
import {
  GEOMETRY_ASSUMPTION_INVENTORY,
  entriesByCategory,
  entriesByStatus,
  findEntry,
  inventoryStatusCounts,
  pyNumericValue,
  tsNumericValue,
} from "../inventory";

describe("geometry assumption inventory", () => {
  it("has entries covering every required category from V2.1A spec", () => {
    const required = [
      "carcass_thickness",
      "back_panel",
      "toe_kick",
      "door_front",
      "reveals",
      "drawer_box",
      "drawer_slide",
      "shelf",
      "shelf_pin",
      "face_frame",
      "hinge",
      "dado_joinery",
      "countertop",
      "handle",
    ] as const;
    for (const cat of required) {
      expect(entriesByCategory(cat).length).toBeGreaterThan(0);
    }
  });

  it("each entry has a stable, unique key", () => {
    const keys = GEOMETRY_ASSUMPTION_INVENTORY.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("every entry has a status", () => {
    for (const e of GEOMETRY_ASSUMPTION_INVENTORY) {
      expect(["match", "different", "ts-only", "python-only"]).toContain(e.status);
    }
  });

  it("status 'different' entries have both a TS and Python value", () => {
    for (const e of entriesByStatus("different")) {
      expect(e.typescriptValue, `${e.key} missing TS value`).not.toBeNull();
      expect(e.pythonValue, `${e.key} missing Python value`).not.toBeNull();
    }
  });

  it("status 'ts-only' entries have TS value and null Python value", () => {
    for (const e of entriesByStatus("ts-only")) {
      expect(e.typescriptValue, `${e.key}`).not.toBeNull();
      expect(e.pythonValue, `${e.key} should have null Python value`).toBeNull();
    }
  });

  it("status 'python-only' entries have Python value and null TS value", () => {
    for (const e of entriesByStatus("python-only")) {
      expect(e.pythonValue, `${e.key}`).not.toBeNull();
      expect(e.typescriptValue, `${e.key} should have null TS value`).toBeNull();
    }
  });

  it("records the known 89 vs 96 toe-kick divergence", () => {
    const entry = findEntry("toe_kick_height");
    expect(entry).toBeDefined();
    expect(entry!.typescriptValue).toBe(89);
    expect(entry!.pythonValue).toBe(96);
    expect(entry!.status).toBe("different");
    expect(entry!.manufacturingImpact).toBe("high");
  });

  it("records the known 19 vs 18 panel-thickness divergence", () => {
    const entry = findEntry("panel_thickness_default");
    expect(entry).toBeDefined();
    expect(entry!.typescriptValue).toBe(19);
    expect(entry!.pythonValue).toBe(18);
    expect(entry!.status).toBe("different");
    expect(entry!.manufacturingImpact).toBe("high");
  });

  it("records the known 19 vs 18 door-thickness divergence", () => {
    const entry = findEntry("door_thickness");
    expect(entry!.typescriptValue).toBe(19);
    expect(entry!.pythonValue).toBe(18);
    expect(entry!.status).toBe("different");
  });

  it("records that Python has a back panel and TS doesn't", () => {
    const entry = findEntry("back_panel_thickness");
    expect(entry!.status).toBe("python-only");
    expect(entry!.pythonValue).toBe(6);
    expect(entry!.typescriptValue).toBeNull();
  });

  it("records that TS models a countertop and Python doesn't", () => {
    const entry = findEntry("countertop_thickness");
    expect(entry!.status).toBe("ts-only");
    expect(entry!.typescriptValue).toBe(38);
    expect(entry!.pythonValue).toBeNull();
  });

  it("records Python-only face-frame + hinge + shelf-pin concepts", () => {
    expect(findEntry("face_frame_stile_width")!.status).toBe("python-only");
    expect(findEntry("hinge_cup_diameter")!.status).toBe("python-only");
    expect(findEntry("shelf_pin_spacing")!.status).toBe("python-only");
  });

  it("provides numeric getters that respect null values", () => {
    expect(tsNumericValue("toe_kick_height")).toBe(89);
    expect(pyNumericValue("toe_kick_height")).toBe(96);
    expect(tsNumericValue("back_panel_thickness")).toBeUndefined();
    expect(pyNumericValue("countertop_thickness")).toBeUndefined();
    expect(tsNumericValue("does-not-exist")).toBeUndefined();
  });

  it("status counts sum to the total inventory size", () => {
    const counts = inventoryStatusCounts();
    const total = counts.match + counts.different + counts["ts-only"] + counts["python-only"];
    expect(total).toBe(GEOMETRY_ASSUMPTION_INVENTORY.length);
  });
});
