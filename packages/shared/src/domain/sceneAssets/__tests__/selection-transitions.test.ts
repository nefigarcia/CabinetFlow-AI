import { describe, expect, it } from "vitest";
import { sceneAssetSelectionAfterRoomChange } from "../selection-transitions";

describe("sceneAssetSelectionAfterRoomChange", () => {
  it("keeps the selection when the instance's room equals the new room", () => {
    expect(sceneAssetSelectionAfterRoomChange("roomA", "roomA")).toBe("keep");
  });

  it("clears when the instance's room differs from the new room", () => {
    expect(sceneAssetSelectionAfterRoomChange("roomA", "roomB")).toBe("clear");
  });

  it("clears when the new room is null (leaving any room)", () => {
    expect(sceneAssetSelectionAfterRoomChange("roomA", null)).toBe("clear");
  });

  it("clears when the selection's room is unknown (no selection or stale id)", () => {
    expect(sceneAssetSelectionAfterRoomChange(undefined, "roomA")).toBe("clear");
  });

  it("clears when both are null/undefined (no selection to preserve)", () => {
    expect(sceneAssetSelectionAfterRoomChange(undefined, null)).toBe("clear");
  });
});
