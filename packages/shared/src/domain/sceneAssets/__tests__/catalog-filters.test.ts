import { describe, expect, it } from "vitest";
import type { SceneAssetDefinition } from "../scene-asset-definition";
import {
  filterCatalogByCategory,
  filterCatalogForRoomType,
  searchCatalog,
} from "../catalog-filters";

function def(
  id: string,
  category: SceneAssetDefinition["category"],
  overrides: Partial<SceneAssetDefinition> = {},
): SceneAssetDefinition {
  return {
    id,
    version: 1,
    name: id,
    category,
    dimensionsMm: { widthMm: 100, heightMm: 100, depthMm: 100 },
    ...overrides,
  };
}

const CATALOG: readonly SceneAssetDefinition[] = [
  def("sofa-1", "furniture", { name: "Modern 3-Seat Sofa" }),
  def("chair-1", "furniture", { name: "Armchair" }),
  def("fridge-1", "appliance", { name: 'Refrigerator (36")', manufacturer: "Acme" }),
  def("range-1", "appliance", { name: 'Range (30")' }),
  def("plant-1", "plant", { name: "Potted Plant" }),
  def("rug-1", "rug", { name: "Area Rug", metadata: { style: "modern" } }),
  def("tub-1", "plumbing", { name: "Freestanding Tub" }),
];

describe("filterCatalogByCategory", () => {
  it("returns only definitions in the given category", () => {
    expect(filterCatalogByCategory(CATALOG, "furniture").map((d) => d.id).sort()).toEqual([
      "chair-1",
      "sofa-1",
    ]);
    expect(filterCatalogByCategory(CATALOG, "plumbing").map((d) => d.id)).toEqual(["tub-1"]);
  });

  it("returns [] for categories with no members", () => {
    expect(filterCatalogByCategory(CATALOG, "lighting")).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const snap = CATALOG.length;
    filterCatalogByCategory(CATALOG, "furniture");
    expect(CATALOG.length).toBe(snap);
  });

  it("returns [] for an empty catalog", () => {
    expect(filterCatalogByCategory([], "furniture")).toEqual([]);
  });
});

describe("filterCatalogForRoomType", () => {
  it("kitchen shows kitchen-relevant categories only", () => {
    const ids = filterCatalogForRoomType(CATALOG, "kitchen").map((d) => d.id).sort();
    // kitchen recommends: appliance, furniture, lighting, plumbing, decor, plant, rug
    // CATALOG entries in those: sofa-1, chair-1 (furniture); fridge-1, range-1 (appliance);
    // plant-1 (plant); rug-1 (rug); tub-1 (plumbing)
    expect(ids).toEqual([
      "chair-1",
      "fridge-1",
      "plant-1",
      "range-1",
      "rug-1",
      "sofa-1",
      "tub-1",
    ]);
  });

  it("bedroom hides appliances + plumbing", () => {
    const ids = filterCatalogForRoomType(CATALOG, "bedroom").map((d) => d.id);
    expect(ids).not.toContain("fridge-1");
    expect(ids).not.toContain("range-1");
    expect(ids).not.toContain("tub-1");
    expect(ids).toContain("sofa-1");
  });

  it("bathroom hides furniture + appliances", () => {
    const ids = filterCatalogForRoomType(CATALOG, "bathroom").map((d) => d.id);
    expect(ids).not.toContain("sofa-1");
    expect(ids).not.toContain("fridge-1");
    expect(ids).toContain("tub-1");
  });

  it("custom shows every entry", () => {
    expect(filterCatalogForRoomType(CATALOG, "custom").length).toBe(CATALOG.length);
  });

  it("returns [] for an empty catalog regardless of room type", () => {
    expect(filterCatalogForRoomType([], "kitchen")).toEqual([]);
    expect(filterCatalogForRoomType([], "custom")).toEqual([]);
  });
});

describe("searchCatalog", () => {
  it("returns the catalog unchanged for empty / whitespace query", () => {
    expect(searchCatalog(CATALOG, "").length).toBe(CATALOG.length);
    expect(searchCatalog(CATALOG, "   ").length).toBe(CATALOG.length);
  });

  it("matches on name (case-insensitive)", () => {
    expect(searchCatalog(CATALOG, "sofa").map((d) => d.id)).toEqual(["sofa-1"]);
    expect(searchCatalog(CATALOG, "SOFA").map((d) => d.id)).toEqual(["sofa-1"]);
    expect(searchCatalog(CATALOG, "chair").map((d) => d.id)).toEqual(["chair-1"]);
  });

  it("matches on category", () => {
    expect(searchCatalog(CATALOG, "appliance").map((d) => d.id).sort()).toEqual([
      "fridge-1",
      "range-1",
    ]);
  });

  it("matches on manufacturer", () => {
    expect(searchCatalog(CATALOG, "acme").map((d) => d.id)).toEqual(["fridge-1"]);
  });

  it("matches on string values in metadata", () => {
    expect(searchCatalog(CATALOG, "modern").map((d) => d.id).sort()).toEqual([
      "rug-1",
      "sofa-1", // name "Modern 3-Seat Sofa" also matches
    ]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchCatalog(CATALOG, "zzzz-nonexistent")).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const snap = CATALOG.length;
    searchCatalog(CATALOG, "sofa");
    expect(CATALOG.length).toBe(snap);
  });
});
