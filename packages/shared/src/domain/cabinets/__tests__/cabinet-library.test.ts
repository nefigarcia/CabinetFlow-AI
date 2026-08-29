import { describe, expect, it } from "vitest";
import {
  CABINET_CATEGORIES,
  CABINET_LIBRARY,
  filterLibraryByCategory,
  getCabinetLibraryEntry,
  getUnionOfWidthPresets,
  searchLibrary,
} from "../cabinet-library";

describe("cabinet library", () => {
  it("every entry references an existing CabinetType", () => {
    const valid = new Set([
      "base",
      "wall",
      "tall",
      "corner",
      "drawer_base",
      "sink_base",
      "island",
    ]);
    for (const e of CABINET_LIBRARY) expect(valid.has(e.type)).toBe(true);
  });

  it("every entry has a category from the enumerated list", () => {
    const cats = new Set(CABINET_CATEGORIES);
    for (const e of CABINET_LIBRARY) expect(cats.has(e.category)).toBe(true);
  });

  it("width presets are ascending + positive", () => {
    for (const e of CABINET_LIBRARY) {
      let prev = 0;
      for (const w of e.widthPresetsMm) {
        expect(w).toBeGreaterThan(0);
        expect(w).toBeGreaterThan(prev);
        prev = w;
      }
    }
  });

  it("filterLibraryByCategory returns only matches", () => {
    const bases = filterLibraryByCategory(CABINET_LIBRARY, "base");
    for (const e of bases) expect(e.category).toBe("base");
  });

  it("filterLibraryByCategory('all') returns a copy", () => {
    const all = filterLibraryByCategory(CABINET_LIBRARY, "all");
    expect(all).toHaveLength(CABINET_LIBRARY.length);
  });

  it("searchLibrary matches name / description / id / type", () => {
    expect(searchLibrary(CABINET_LIBRARY, "drawer").length).toBeGreaterThan(0);
    expect(searchLibrary(CABINET_LIBRARY, "sink").length).toBeGreaterThan(0);
    expect(searchLibrary(CABINET_LIBRARY, "").length).toBe(CABINET_LIBRARY.length);
  });

  it("getCabinetLibraryEntry looks up by id", () => {
    expect(getCabinetLibraryEntry("base-standard")?.type).toBe("base");
    expect(getCabinetLibraryEntry("does-not-exist")).toBeUndefined();
  });

  it("getUnionOfWidthPresets is sorted and deduplicated", () => {
    const u = getUnionOfWidthPresets();
    for (let i = 1; i < u.length; i++) expect(u[i]!).toBeGreaterThan(u[i - 1]!);
  });
});
