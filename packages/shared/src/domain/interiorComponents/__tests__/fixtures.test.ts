import { describe, expect, it } from "vitest";
import {
  BIBB_FIXTURE_A,
  BIBB_FIXTURE_B_ISLAND,
  BIBB_FIXTURE_B_SINK,
  BIBB_FIXTURE_C,
  KLINT_ROLLOUT_FIXTURE,
  cabinetInteriorComponentsArraySchema,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// Evidence-based fixtures. Every value must parse cleanly through the
// canonical Zod array schema — proves we didn't accidentally invent
// invalid data.
//
// Also documents STRUCTURAL expectations per fixture (component count,
// key types present) so future doc revisions can't silently mutate
// the intent.
// ═══════════════════════════════════════════════════════════════════════

describe("Bibb Fixture A — spice/knife cabinet", () => {
  it("parses through the array schema cleanly", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse(BIBB_FIXTURE_A).success).toBe(true);
  });
  it("contains exactly 5 components — spice, knife, hidden, dividers, utensil", () => {
    expect(BIBB_FIXTURE_A.length).toBe(5);
    const types = BIBB_FIXTURE_A.map((c) => c.type).sort();
    expect(types).toEqual([
      "drawer_divider",
      "hidden_drawer",
      "knife_organizer",
      "spice_rack",
      "utensil_divider",
    ]);
  });
  it("all components carry a Bibb sourceRef (verified provenance)", () => {
    for (const c of BIBB_FIXTURE_A) {
      expect(c.sourceRef).toMatch(/Bibb Cabinetry Layouts/);
      expect(c.verificationStatus).toBe("verified");
    }
  });
  it("does NOT fabricate drawer target indices where the source is silent", () => {
    // The source doc lists "Removable dividers" and "Knife Storage"
    // generically. Fixture must NOT invent target indices.
    const knife = BIBB_FIXTURE_A.find((c) => c.type === "knife_organizer");
    expect(knife?.target).toBeUndefined();
  });
});

describe("Bibb Fixture B — sink + island trash/tray/hidden", () => {
  it("both arrays parse cleanly", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse(BIBB_FIXTURE_B_SINK).success).toBe(true);
    expect(cabinetInteriorComponentsArraySchema.safeParse(BIBB_FIXTURE_B_ISLAND).success).toBe(true);
  });
  it("SINK cabinet has sponge_tilt_out + sink_pullout", () => {
    expect(BIBB_FIXTURE_B_SINK.map((c) => c.type).sort()).toEqual([
      "sink_pullout",
      "sponge_tilt_out",
    ]);
  });
  it("ISLAND cabinet trash_pullout has evidenced bins=2, 35qt, double config", () => {
    const trash = BIBB_FIXTURE_B_ISLAND.find((c) => c.type === "trash_pullout");
    expect(trash).toBeDefined();
    if (trash?.type === "trash_pullout") {
      expect(trash.bins).toBe(2);
      expect(trash.nominalBinSizeQt).toBe(35);
      expect(trash.configuration).toBe("double");
    }
  });
  it("hidden drawer above trash has location=above_trash", () => {
    const hidden = BIBB_FIXTURE_B_ISLAND.find((c) => c.type === "hidden_drawer");
    expect(hidden).toBeDefined();
    if (hidden?.type === "hidden_drawer") {
      expect(hidden.location).toBe("above_trash");
    }
  });
  it("tray_divider carries no fabricated quantity", () => {
    const tray = BIBB_FIXTURE_B_ISLAND.find((c) => c.type === "tray_divider");
    if (tray?.type === "tray_divider") {
      expect(tray.quantity).toBeUndefined();
    }
  });
});

describe("Bibb Fixture C — pullout cabinet", () => {
  it("parses cleanly", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse(BIBB_FIXTURE_C).success).toBe(true);
  });
  it("rollout has openSides=true (evidenced) and NO fabricated quantity", () => {
    const r = BIBB_FIXTURE_C.find((c) => c.type === "rollout");
    if (r?.type === "rollout") {
      expect(r.openSides).toBe(true);
      expect(r.quantity).toBeUndefined();
    }
  });
  it("small hidden drawer has location=inside_cabinet", () => {
    const h = BIBB_FIXTURE_C.find((c) => c.type === "hidden_drawer");
    if (h?.type === "hidden_drawer") {
      expect(h.location).toBe("inside_cabinet");
    }
  });
  it("has two drawer_divider entries — a plain and a removable — per source", () => {
    const dividers = BIBB_FIXTURE_C.filter((c) => c.type === "drawer_divider");
    expect(dividers.length).toBe(2);
    const removableCount = dividers.filter(
      (c) => c.type === "drawer_divider" && c.removable === true,
    ).length;
    expect(removableCount).toBe(1);
  });
});

describe("Klint rollout fixture", () => {
  it("parses cleanly", () => {
    expect(cabinetInteriorComponentsArraySchema.safeParse(KLINT_ROLLOUT_FIXTURE).success).toBe(true);
  });
  it("carries Klint sourceRef and no fabricated quantity", () => {
    const r = KLINT_ROLLOUT_FIXTURE[0];
    expect(r?.sourceRef).toMatch(/Klint/);
    if (r?.type === "rollout") {
      expect(r.quantity).toBeUndefined();
      expect(r.openSides).toBeUndefined();
    }
  });
});
