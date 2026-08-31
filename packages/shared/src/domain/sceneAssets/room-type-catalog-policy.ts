import type { SceneAssetCategory } from "./scene-asset-category";
import { SCENE_ASSET_CATEGORIES } from "./scene-asset-category";
import type { RoomType } from "./room-type";

// Room-type → recommended SceneAssetCategory policy.
//
// IMPORTANT: this is a UI DEFAULT, not a hard restriction. The catalog UI
// surfaces the recommended categories first, but users can always view
// "All" to reach the full catalog. Do NOT use this map to permanently
// hide definitions — WoodCraft OS must stay flexible for custom projects.
//
// The lists intentionally omit categories that are unlikely to help for a
// given room (e.g. "plumbing" in a bedroom) but this is stylistic, not
// exhaustive.

export const ROOM_TYPE_RECOMMENDED_CATEGORIES: Record<
  RoomType,
  readonly SceneAssetCategory[]
> = {
  kitchen: [
    "appliance",
    "furniture",
    "lighting",
    "plumbing",
    "decor",
    "plant",
    "rug",
  ],
  living_room: [
    "furniture",
    "lighting",
    "electronics",
    "decor",
    "plant",
    "rug",
  ],
  bedroom: ["furniture", "lighting", "decor", "plant", "rug"],
  bathroom: ["plumbing", "fixture", "lighting", "decor", "plant"],
  closet: ["furniture", "lighting", "decor"],
  laundry: ["appliance", "plumbing", "fixture", "lighting", "decor"],
  office: ["furniture", "electronics", "lighting", "decor", "plant", "rug"],
  // `custom` reveals every category — no policy applies, the user is on
  // their own with a general-purpose room.
  custom: SCENE_ASSET_CATEGORIES,
};

/** Returns the ordered recommended-category list for the given room type.
 *  Never returns undefined; always at least an empty array. `custom`
 *  returns every category in `SCENE_ASSET_CATEGORIES`. */
export function getRecommendedCategoriesForRoomType(
  roomType: RoomType,
): readonly SceneAssetCategory[] {
  return ROOM_TYPE_RECOMMENDED_CATEGORIES[roomType] ?? [];
}
