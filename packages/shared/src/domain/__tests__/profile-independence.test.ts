import { describe, expect, it } from "vitest";
import { adaptLegacyCabinet } from "../adapters/legacy-cabinet";
import { resolveEffectiveConfiguration } from "../inheritance/resolver";
import {
  createLegacyCadProfile,
  createLegacyVisualProfile,
} from "../profiles/construction";
import {
  demoConstructionRef,
  demoConstructionRefV2,
  legacyFramelessBase,
  makeDemoProfileRegistry,
} from "./fixtures";

// A cabinet's DESIGN INTENT must be independent of the ConstructionProfile
// used to interpret it. This mirrors the Cabinet Vision idea that the same
// cabinet "structure" can be resolved into different physical products by
// swapping the construction style.

describe("cabinet intent is independent of the resolved construction profile", () => {
  it("the same adapted cabinet is unchanged when resolved with two different profiles", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    const before = structuredClone(design);

    const reg = makeDemoProfileRegistry();

    resolveEffectiveConfiguration({
      cabinet: {
        id: design.id,
        constructionProfileRef: demoConstructionRef,
      },
      profiles: reg,
    });

    resolveEffectiveConfiguration({
      cabinet: {
        id: design.id,
        constructionProfileRef: demoConstructionRefV2,
      },
      profiles: reg,
    });

    expect(design).toEqual(before);
  });

  it("produces materially different effective configurations for two profiles", () => {
    const reg = makeDemoProfileRegistry();

    const a = resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        constructionProfileRef: demoConstructionRef,
      },
      profiles: reg,
    });
    const b = resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        constructionProfileRef: demoConstructionRefV2,
      },
      profiles: reg,
    });

    expect(a.effective.construction?.panelThicknessMm).not.toBe(
      b.effective.construction?.panelThicknessMm,
    );
    expect(a.effective.construction?.toeKick.heightMm).not.toBe(
      b.effective.construction?.toeKick.heightMm,
    );
  });

  it("resolving twice with the same input is deterministic", () => {
    const reg = makeDemoProfileRegistry();
    const a = resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        constructionProfileRef: demoConstructionRef,
      },
      profiles: reg,
    });
    const b = resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        constructionProfileRef: demoConstructionRef,
      },
      profiles: reg,
    });
    expect(a).toEqual(b);
  });

  it("registry profile is not mutated when resolver applies overrides", () => {
    const cleanVisual = createLegacyVisualProfile();
    const cleanCad = createLegacyCadProfile();
    const reg = makeDemoProfileRegistry();

    resolveEffectiveConfiguration({
      cabinet: {
        id: "cab_1",
        constructionProfileRef: demoConstructionRef,
        overrides: { construction: { panelThicknessMm: 999 } },
      },
      profiles: reg,
    });

    const stillCleanVisual = reg.construction(demoConstructionRef);
    const stillCleanCad = reg.construction(demoConstructionRefV2);
    expect(stillCleanVisual?.panelThicknessMm).toBe(cleanVisual.panelThicknessMm);
    expect(stillCleanCad?.panelThicknessMm).toBe(cleanCad.panelThicknessMm);
  });
});
