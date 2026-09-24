import { describe, expect, it } from "vitest";
import {
  addInteriorComponent,
  buildInteriorComponentsPatch,
  INTERIOR_COMPONENTS_PARAM_KEY,
  readInteriorComponentsSafe,
  removeInteriorComponent,
  reorderInteriorComponents,
  setInteriorComponentEnabled,
  updateInteriorComponent,
  type CabinetInteriorComponent,
} from "../";
import { applyCabinetParametersPatch } from "../../cabinets";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 patch semantics tests.
//
// Contract:
//   · Atomic array replacement
//   · Sibling Cabinet.parameters keys preserved
//   · `null` rejected (Zod)
//   · Empty array clears components
//   · Omitting the key preserves the array
// ═══════════════════════════════════════════════════════════════════════

const c = (id: string): CabinetInteriorComponent => ({
  id,
  enabled: true,
  type: "spice_rack",
});

describe("Cabinet.parameters interiorComponents — atomic replacement", () => {
  it("PATCH { interiorComponents: [] } clears the list", () => {
    const prev = { doorCount: 2, interiorComponents: [c("a"), c("b")] };
    const next = applyCabinetParametersPatch(prev, { interiorComponents: [] });
    expect(next.interiorComponents).toEqual([]);
    expect(next.doorCount).toBe(2);
  });

  it("PATCH { interiorComponents: [x,y] } replaces atomically", () => {
    const prev = { doorCount: 2, interiorComponents: [c("a")] };
    const next = applyCabinetParametersPatch(prev, {
      interiorComponents: [c("b"), c("c")],
    });
    expect((next.interiorComponents as CabinetInteriorComponent[]).map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("PATCH omitting interiorComponents preserves the existing array", () => {
    const prev = { doorCount: 2, interiorComponents: [c("a"), c("b")] };
    const next = applyCabinetParametersPatch(prev, { doorCount: 3 });
    expect((next.interiorComponents as CabinetInteriorComponent[]).map((x) => x.id)).toEqual(["a", "b"]);
    expect(next.doorCount).toBe(3);
  });

  it("preserves ALL sibling parameter keys through an interior-components PATCH", () => {
    const prev = {
      doorCount: 2,
      drawerCount: 4,
      shelfCount: 1,
      familyRuleId: "fr1",
      frontSystemId: "fs1",
      drawerSystemId: "ds1",
      wallPlacement: { x: 100, y: 200 },
      disableFamilyRule: true,
      constructionProfileId: "cp1",
      hingeType: "concealed",
      customKey: "keep-me",
    };
    const next = applyCabinetParametersPatch(prev, {
      interiorComponents: [c("x")],
    });
    for (const [k, v] of Object.entries(prev)) {
      expect(next[k]).toEqual(v);
    }
    expect((next.interiorComponents as CabinetInteriorComponent[]).map((x) => x.id)).toEqual(["x"]);
  });
});

describe("buildInteriorComponentsPatch — patch-body constructor", () => {
  it("produces a PATCH body targeting only interiorComponents", () => {
    const patch = buildInteriorComponentsPatch([c("a"), c("b")]);
    expect(patch).toEqual({
      parameters: {
        interiorComponents: [c("a"), c("b")],
      },
    });
    expect(INTERIOR_COMPONENTS_PARAM_KEY).toBe("interiorComponents");
  });
});

describe("readInteriorComponentsSafe — safe read (Phase 3.1a)", () => {
  it("returns ok([]) for null / undefined / missing key", () => {
    expect(readInteriorComponentsSafe(null)).toEqual({ status: "ok", components: [] });
    expect(readInteriorComponentsSafe(undefined)).toEqual({ status: "ok", components: [] });
    expect(readInteriorComponentsSafe({})).toEqual({ status: "ok", components: [] });
  });

  it("returns the array when it validates cleanly", () => {
    const arr = [c("x"), c("y")];
    expect(readInteriorComponentsSafe({ interiorComponents: arr })).toEqual({ status: "ok", components: arr });
  });

  // Phase 3.0 asserted `[]` here — that fallback let the Inspector show an
  // empty list and the next Add overwrite the real stored array. 3.1a
  // replaces it: malformed stored data is UNREADABLE, never [].
  it("an invalid element makes the value unreadable (NOT [])", () => {
    const bad = { interiorComponents: [{ id: "x", enabled: true, type: "made_up" }] };
    const r = readInteriorComponentsSafe(bad);
    expect(r.status).toBe("unreadable");
  });

  it("a non-array stored value is unreadable (NOT [])", () => {
    expect(readInteriorComponentsSafe({ interiorComponents: "not-array" }).status).toBe("unreadable");
    expect(readInteriorComponentsSafe({ interiorComponents: null }).status).toBe("unreadable");
  });
});

// ─── Local array operations (client-side) ─────────────────────────────

describe("addInteriorComponent", () => {
  it("appends to the end", () => {
    expect(addInteriorComponent([c("a")], c("b"))).toEqual([c("a"), c("b")]);
  });
  it("does not mutate the input array", () => {
    const input = [c("a")];
    addInteriorComponent(input, c("b"));
    expect(input).toEqual([c("a")]);
  });
});

describe("updateInteriorComponent — complete replacement (§E rule)", () => {
  it("replaces the component with matching id", () => {
    const replacement: CabinetInteriorComponent = { id: "a", enabled: false, type: "hidden_drawer", location: "inside_cabinet" };
    expect(updateInteriorComponent([c("a"), c("b")], "a", replacement)).toEqual([replacement, c("b")]);
  });
  it("throws when replacement.id != componentId", () => {
    expect(() =>
      updateInteriorComponent([c("a")], "a", { ...c("z") }),
    ).toThrow(/replacement\.id \(z\) must equal componentId \(a\)/);
  });
  it("throws when componentId not found", () => {
    expect(() =>
      updateInteriorComponent([c("a")], "nope", c("nope")),
    ).toThrow(/no interior component with id=nope/);
  });
});

describe("removeInteriorComponent", () => {
  it("removes only the matching id", () => {
    expect(removeInteriorComponent([c("a"), c("b"), c("c")], "b").map((x) => x.id)).toEqual([
      "a",
      "c",
    ]);
  });
  it("no-op when id not found (Phase 3.0 quiet)", () => {
    expect(removeInteriorComponent([c("a")], "z").map((x) => x.id)).toEqual(["a"]);
  });
});

describe("setInteriorComponentEnabled", () => {
  it("toggles enabled on matching id, preserves others", () => {
    const out = setInteriorComponentEnabled([c("a"), c("b")], "a", false);
    expect(out[0]!.enabled).toBe(false);
    expect(out[1]!.enabled).toBe(true);
  });
});

describe("reorderInteriorComponents", () => {
  it("reorders per the given id sequence", () => {
    const out = reorderInteriorComponents([c("a"), c("b"), c("c")], ["c", "a", "b"]);
    expect(out.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
  it("throws on missing id", () => {
    expect(() => reorderInteriorComponents([c("a"), c("b")], ["a", "z"])).toThrow(/unknown id/);
  });
  it("throws on length mismatch", () => {
    expect(() => reorderInteriorComponents([c("a"), c("b")], ["a"])).toThrow(/length/);
  });
});
