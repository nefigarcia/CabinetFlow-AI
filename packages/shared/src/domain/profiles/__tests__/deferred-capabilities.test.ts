import { describe, expect, it } from "vitest";
import {
  DEFERRED_CAPABILITIES,
  deferredCapabilitiesArraySchema,
  deferredCapabilitySchema,
  effectiveDeferredCapabilities,
  makeStrictDeferredCapabilitiesSchema,
  readDeferredCapabilities,
} from "../";

const HAWKES_SOURCE = "Hawkes Kitchen Build Sheets 03/27/26";
const KLINT_SOURCE = "Klint Anderson Shop Packet";

describe("readDeferredCapabilities — fail-closed parsing", () => {
  it("null metadata → empty array", () => {
    expect(readDeferredCapabilities(null)).toEqual([]);
    expect(readDeferredCapabilities(undefined)).toEqual([]);
  });

  it("empty object → empty array", () => {
    expect(readDeferredCapabilities({})).toEqual([]);
  });

  it("malformed metadata.deferredCapabilities → empty array (fail-closed)", () => {
    expect(readDeferredCapabilities({ deferredCapabilities: "not-an-array" })).toEqual([]);
    expect(readDeferredCapabilities({ deferredCapabilities: 42 })).toEqual([]);
  });

  it("well-formed entry survives round-trip", () => {
    const md = {
      deferredCapabilities: [
        {
          capability: "typed_drawer_construction",
          status: "verified_but_unmodeled",
          sourceRef: HAWKES_SOURCE,
          facts: { bottomThicknessIn: 0.25, sideThicknessIn: 0.625 },
        },
      ],
    };
    const out = readDeferredCapabilities(md);
    expect(out).toHaveLength(1);
    expect(out[0]!.capability).toBe("typed_drawer_construction");
    expect(out[0]!.facts?.bottomThicknessIn).toBe(0.25);
  });

  it("invalid status → whole array rejected (fail-closed)", () => {
    const md = {
      deferredCapabilities: [
        { capability: "x", status: "totally_bogus", sourceRef: "s" },
      ],
    };
    expect(readDeferredCapabilities(md)).toEqual([]);
  });
});

describe("Loose vs strict deferred-capabilities schema", () => {
  it("loose schema accepts forward-compat unknown capability name", () => {
    const parsed = deferredCapabilitySchema.safeParse({
      capability: "future_typed_hinge_system",
      status: "verified_but_unmodeled",
      sourceRef: "test",
    });
    expect(parsed.success).toBe(true);
  });

  it("strict schema rejects unknown capability", () => {
    const strict = makeStrictDeferredCapabilitiesSchema(DEFERRED_CAPABILITIES);
    const parsed = strict.safeParse([
      { capability: "future_typed_hinge_system", status: "verified_but_unmodeled", sourceRef: "s" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("strict schema accepts a canonical name", () => {
    const strict = makeStrictDeferredCapabilitiesSchema(DEFERRED_CAPABILITIES);
    const parsed = strict.safeParse([
      { capability: "typed_drawer_system", status: "verified_but_unmodeled", sourceRef: "s" },
    ]);
    expect(parsed.success).toBe(true);
  });
});

describe("effectiveDeferredCapabilities — attribution preserved", () => {
  it("Hawkes drawer construction + Klint Legrabox → two entries, correctly scoped", () => {
    const hawkesMeta = {
      deferredCapabilities: [
        {
          capability: "typed_drawer_construction",
          status: "verified_but_unmodeled",
          sourceRef: HAWKES_SOURCE,
          facts: { bottomThicknessIn: 0.25 },
        },
      ],
    };
    const klintMeta = {
      deferredCapabilities: [
        {
          capability: "typed_drawer_system",
          status: "verified_but_unmodeled",
          sourceRef: KLINT_SOURCE,
          value: "Blum Legrabox",
        },
      ],
    };
    const eff = effectiveDeferredCapabilities({
      contributions: [
        { scope: "project", kind: "construction", metadata: hawkesMeta },
        { scope: "project", kind: "construction", metadata: klintMeta },
      ],
    });
    expect(eff).toHaveLength(2);
    expect(eff.find((e) => e.capability.capability === "typed_drawer_construction")?.scope)
      .toBe("project");
    expect(eff.find((e) => e.capability.capability === "typed_drawer_system")?.capability.value)
      .toBe("Blum Legrabox");
  });

  it("no metadata anywhere → empty", () => {
    const eff = effectiveDeferredCapabilities({
      contributions: [
        { scope: "organization", kind: "construction", metadata: null },
        { scope: "project",      kind: "material",     metadata: {} },
      ],
    });
    expect(eff).toEqual([]);
  });
});

describe("deferredCapabilitiesArraySchema — cap length", () => {
  it("accepts up to 50 entries", () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      capability: `x${i}`,
      status: "verified_but_unmodeled" as const,
      sourceRef: "s",
    }));
    expect(deferredCapabilitiesArraySchema.safeParse(entries).success).toBe(true);
  });
  it("rejects 51+ entries", () => {
    const entries = Array.from({ length: 51 }, (_, i) => ({
      capability: `x${i}`,
      status: "verified_but_unmodeled" as const,
      sourceRef: "s",
    }));
    expect(deferredCapabilitiesArraySchema.safeParse(entries).success).toBe(false);
  });
});
