import { describe, expect, it } from "vitest";
import type { Cabinet } from "../../../types/cabinet";
import {
  readDoorConfig,
  readDrawerBankIntent,
  readShelfIntent,
  withDoorConfig,
  withDrawerBankIntent,
  withShelfIntent,
} from "../interior-intent";

function makeCab(type: Cabinet["type"], parameters: Cabinet["parameters"] = {}): Pick<Cabinet, "type" | "parameters"> {
  return { type, parameters };
}

describe("drawer bank intent", () => {
  it("drawer_base defaults to 4 drawers equal heights when unset", () => {
    const intent = readDrawerBankIntent(makeCab("drawer_base"));
    expect(intent).toEqual({ count: 4, heightPattern: "equal" });
  });

  it("base defaults to 0 drawers", () => {
    expect(readDrawerBankIntent(makeCab("base"))).toEqual({ count: 0, heightPattern: "equal" });
  });

  it("writes count + pattern into the parameters bag", () => {
    const p = withDrawerBankIntent(undefined, { count: 3, heightPattern: "top-small" });
    expect(p.drawerCount).toBe(3);
    expect((p as Record<string, unknown>).drawerHeightPattern).toBe("top-small");
  });

  it("clamps negative + non-integer counts", () => {
    const p = withDrawerBankIntent({}, { count: -2 });
    expect(p.drawerCount).toBe(0);
    const q = withDrawerBankIntent({}, { count: 3.7 });
    expect(q.drawerCount).toBe(3);
  });
});

describe("shelf intent", () => {
  it("wall defaults to 2 adjustable", () => {
    expect(readShelfIntent(makeCab("wall"))).toEqual({ count: 2, policy: "adjustable" });
  });

  it("tall defaults to 4 adjustable", () => {
    expect(readShelfIntent(makeCab("tall"))).toEqual({ count: 4, policy: "adjustable" });
  });

  it("persists fixed policy", () => {
    const p = withShelfIntent({}, { count: 3, policy: "fixed" });
    expect((p as Record<string, unknown>).shelfPolicy).toBe("fixed");
    expect(p.shelfCount).toBe(3);
  });
});

describe("door config", () => {
  it("infers single/double/none from doorCount", () => {
    expect(readDoorConfig({ parameters: { doorCount: 0 } })).toBe("none");
    expect(readDoorConfig({ parameters: { doorCount: 1 } })).toBe("single");
    expect(readDoorConfig({ parameters: { doorCount: 2 } })).toBe("double");
    expect(readDoorConfig({ parameters: { doorCount: 3 } })).toBe("double");
  });

  it("writes back an integer doorCount", () => {
    expect(withDoorConfig({}, "none").doorCount).toBe(0);
    expect(withDoorConfig({}, "single").doorCount).toBe(1);
    expect(withDoorConfig({}, "double").doorCount).toBe(2);
  });
});
