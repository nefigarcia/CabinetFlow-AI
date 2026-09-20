import { describe, expect, it } from "vitest";
import { assertProfileBelongsToOrg } from "../";

describe("assertProfileBelongsToOrg", () => {
  it("null profile → not_found", () => {
    expect(assertProfileBelongsToOrg(null, "org_a")).toEqual({ ok: false, reason: "not_found" });
    expect(assertProfileBelongsToOrg(undefined, "org_a")).toEqual({ ok: false, reason: "not_found" });
  });

  it("cross-org profile → not_found (no info leak)", () => {
    expect(
      assertProfileBelongsToOrg({ id: "p1", orgId: "org_b" }, "org_a"),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("same-org profile → ok", () => {
    const result = assertProfileBelongsToOrg({ id: "p1", orgId: "org_a" }, "org_a");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.id).toBe("p1");
  });
});
