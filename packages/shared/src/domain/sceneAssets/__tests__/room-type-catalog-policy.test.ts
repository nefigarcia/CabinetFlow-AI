import { describe, expect, it } from "vitest";
import { SCENE_ASSET_CATEGORIES } from "../scene-asset-category";
import { ROOM_TYPES } from "../room-type";
import {
  getRecommendedCategoriesForRoomType,
  ROOM_TYPE_RECOMMENDED_CATEGORIES,
} from "../room-type-catalog-policy";

describe("ROOM_TYPE_RECOMMENDED_CATEGORIES", () => {
  it("has an entry for every RoomType", () => {
    for (const type of ROOM_TYPES) {
      expect(ROOM_TYPE_RECOMMENDED_CATEGORIES[type]).toBeDefined();
    }
  });

  it("only names categories that exist in SCENE_ASSET_CATEGORIES", () => {
    const known = new Set<string>(SCENE_ASSET_CATEGORIES);
    for (const type of ROOM_TYPES) {
      for (const cat of ROOM_TYPE_RECOMMENDED_CATEGORIES[type]) {
        expect(known.has(cat)).toBe(true);
      }
    }
  });

  it("each list has no duplicate categories", () => {
    for (const type of ROOM_TYPES) {
      const list = ROOM_TYPE_RECOMMENDED_CATEGORIES[type];
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("`custom` exposes every category (no policy applies)", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.custom.length).toBe(
      SCENE_ASSET_CATEGORIES.length,
    );
  });

  it("kitchen recommends appliance + furniture + lighting + plumbing + decor + plant + rug", () => {
    expect(new Set(ROOM_TYPE_RECOMMENDED_CATEGORIES.kitchen)).toEqual(
      new Set(["appliance", "furniture", "lighting", "plumbing", "decor", "plant", "rug"]),
    );
  });

  it("bathroom recommends plumbing + fixture + lighting + decor + plant", () => {
    expect(new Set(ROOM_TYPE_RECOMMENDED_CATEGORIES.bathroom)).toEqual(
      new Set(["plumbing", "fixture", "lighting", "decor", "plant"]),
    );
  });

  it("bedroom does NOT recommend plumbing or appliances", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.bedroom).not.toContain("plumbing");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.bedroom).not.toContain("appliance");
  });

  it("laundry recommends appliances + plumbing", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.laundry).toContain("appliance");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.laundry).toContain("plumbing");
  });

  it("closet excludes appliance / plumbing / electronics", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.closet).not.toContain("appliance");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.closet).not.toContain("plumbing");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.closet).not.toContain("electronics");
  });

  it("office recommends electronics", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.office).toContain("electronics");
  });

  it("living_room recommends electronics + decor + rug", () => {
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.living_room).toContain("electronics");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.living_room).toContain("decor");
    expect(ROOM_TYPE_RECOMMENDED_CATEGORIES.living_room).toContain("rug");
  });
});

describe("getRecommendedCategoriesForRoomType", () => {
  it("returns the same list as the constant map", () => {
    for (const type of ROOM_TYPES) {
      expect(getRecommendedCategoriesForRoomType(type)).toBe(
        ROOM_TYPE_RECOMMENDED_CATEGORIES[type],
      );
    }
  });
});
