import { describe, expect, it } from "vitest";
import type { ProfileRegistry } from "../inheritance/resolver";
import { resolveEffectiveConfiguration } from "../inheritance/resolver";
import {
  createLegacyCadProfile,
  createLegacyVisualProfile,
} from "../profiles/construction";
import { makeDemoHardwareProfile, makeDemoMaterialProfile } from "./fixtures";

function registry(): ProfileRegistry {
  const construction = new Map([
    ["legacy-visual", createLegacyVisualProfile()],
    ["legacy-cad", createLegacyCadProfile()],
    ["custom-org", { ...createLegacyVisualProfile("custom-org"), panelThicknessMm: 25 }],
  ]);
  const material = new Map([["mat_default", makeDemoMaterialProfile("mat_default")]]);
  const hardware = new Map([["hw_default", makeDemoHardwareProfile("hw_default")]]);
  return {
    construction: (ref) => construction.get(ref.id),
    material: (ref) => material.get(ref.id),
    hardware: (ref) => hardware.get(ref.id),
  };
}

const emptyCabinet = { id: "cab_1" };

describe("resolveEffectiveConfiguration — level precedence", () => {
  it("uses organization defaults when nothing else is set", () => {
    const result = resolveEffectiveConfiguration({
      organization: {
        id: "org",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.effective.construction?.id).toBe("legacy-visual");
    expect(result.sources.constructionRef?.level).toBe("organization");
  });

  it("project overrides organization", () => {
    const result = resolveEffectiveConfiguration({
      organization: {
        id: "org",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-cad", version: 1 } },
      },
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.effective.construction?.id).toBe("legacy-cad");
    expect(result.sources.constructionRef?.level).toBe("project");
  });

  it("room overrides project", () => {
    const result = resolveEffectiveConfiguration({
      organization: {
        id: "org",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-cad", version: 1 } },
      },
      room: {
        id: "room",
        defaults: { constructionProfileRef: { id: "custom-org", version: 1 } },
      },
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.effective.construction?.id).toBe("custom-org");
    expect(result.sources.constructionRef?.level).toBe("room");
  });

  it("cabinet overrides room", () => {
    const result = resolveEffectiveConfiguration({
      room: {
        id: "room",
        defaults: { constructionProfileRef: { id: "custom-org", version: 1 } },
      },
      cabinet: {
        id: "cab_1",
        constructionProfileRef: { id: "legacy-visual", version: 1 },
      },
      profiles: registry(),
    });
    expect(result.effective.construction?.id).toBe("legacy-visual");
    expect(result.sources.constructionRef?.level).toBe("cabinet");
  });

  it("returns undefined when nothing selects a construction profile", () => {
    const result = resolveEffectiveConfiguration({
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.effective.construction).toBeUndefined();
    expect(result.sources.constructionRef).toBeUndefined();
  });

  it("carries profile version through the source record", () => {
    const result = resolveEffectiveConfiguration({
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 7 } },
      },
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.sources.constructionRef?.profileId).toBe("legacy-visual");
    expect(result.sources.constructionRef?.profileVersion).toBe(7);
  });
});

describe("resolveEffectiveConfiguration — cabinet-level overrides", () => {
  it("applies a shallow override to the resolved construction profile", () => {
    const result = resolveEffectiveConfiguration({
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      cabinet: {
        id: "cab_1",
        overrides: { construction: { panelThicknessMm: 25 } },
      },
      profiles: registry(),
    });
    expect(result.effective.construction?.panelThicknessMm).toBe(25);
    expect(result.effective.construction?.id).toBe("legacy-visual");
    expect(result.sources.overrides.construction).toBeDefined();
    expect(result.sources.overrides.construction!["panelThicknessMm"]).toEqual({
      level: "cabinet",
      fromOverride: true,
    });
  });

  it("does not mutate the underlying profile registry", () => {
    const reg = registry();
    resolveEffectiveConfiguration({
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      cabinet: {
        id: "cab_1",
        overrides: { construction: { panelThicknessMm: 99, toeKick: { heightMm: 999 } } },
      },
      profiles: reg,
    });
    const stillClean = reg.construction({ id: "legacy-visual", version: 1 });
    expect(stillClean?.panelThicknessMm).toBe(19);
    expect(stillClean?.toeKick.heightMm).toBe(89);
  });

  it("deep-merges nested override keys (toeKick.heightMm)", () => {
    const result = resolveEffectiveConfiguration({
      project: {
        id: "proj",
        defaults: { constructionProfileRef: { id: "legacy-visual", version: 1 } },
      },
      cabinet: {
        id: "cab_1",
        overrides: { construction: { toeKick: { heightMm: 100 } } },
      },
      profiles: registry(),
    });
    expect(result.effective.construction?.toeKick.heightMm).toBe(100);
    // Sibling keys survive the merge.
    expect(result.effective.construction?.toeKick.enabled).toBe(true);
    expect(result.effective.construction?.toeKick.depthMm).toBe(76);
  });
});

describe("resolveEffectiveConfiguration — material and hardware chains", () => {
  it("resolves material independently from construction", () => {
    const result = resolveEffectiveConfiguration({
      project: {
        id: "proj",
        defaults: {
          constructionProfileRef: { id: "legacy-visual", version: 1 },
          materialProfileRef: { id: "mat_default", version: 1 },
        },
      },
      cabinet: emptyCabinet,
      profiles: registry(),
    });
    expect(result.effective.material?.id).toBe("mat_default");
    expect(result.sources.materialRef?.level).toBe("project");
  });

  it("resolves hardware at the cabinet level", () => {
    const result = resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        hardwareProfileRef: { id: "hw_default", version: 1 },
      },
      profiles: registry(),
    });
    expect(result.effective.hardware?.id).toBe("hw_default");
    expect(result.sources.hardwareRef?.level).toBe("cabinet");
  });
});
