import { describe, expect, it } from "vitest";
import {
  constructionProfileSchema,
  createLegacyCadProfile,
  createLegacyFaceFrameProfile,
  createLegacyVisualProfile,
} from "../profiles/construction";

describe("legacy construction profile factories", () => {
  it("createLegacyVisualProfile mirrors the TS geometry compiler defaults", () => {
    const p = createLegacyVisualProfile();
    expect(p.method).toBe("frameless");
    expect(p.panelThicknessMm).toBe(19);
    expect(p.doorThicknessMm).toBe(19);
    expect(p.toeKick.heightMm).toBe(89);
    expect(p.toeKick.enabled).toBe(true);
  });

  it("createLegacyCadProfile mirrors the Python cad-service defaults", () => {
    const p = createLegacyCadProfile();
    expect(p.method).toBe("frameless");
    expect(p.panelThicknessMm).toBe(18);
    expect(p.backThicknessMm).toBe(6);
    expect(p.doorThicknessMm).toBe(18);
    expect(p.toeKick.heightMm).toBe(96);
  });

  it("createLegacyFaceFrameProfile has face-frame method and stile/rail dimensions", () => {
    const p = createLegacyFaceFrameProfile();
    expect(p.method).toBe("face_frame");
    expect(p.faceFrame).toBeDefined();
    expect(p.faceFrame!.stileWidthMm).toBe(38);
    expect(p.faceFrame!.railWidthMm).toBe(38);
    expect(p.faceFrame!.thicknessMm).toBe(19);
  });

  it("the two frameless legacy profiles are structurally different", () => {
    const visual = createLegacyVisualProfile();
    const cad = createLegacyCadProfile();
    expect(visual.panelThicknessMm).not.toBe(cad.panelThicknessMm);
    expect(visual.toeKick.heightMm).not.toBe(cad.toeKick.heightMm);
  });

  it("all three legacy factories produce zod-valid profiles", () => {
    for (const p of [
      createLegacyVisualProfile(),
      createLegacyCadProfile(),
      createLegacyFaceFrameProfile(),
    ]) {
      expect(() => constructionProfileSchema.parse(p)).not.toThrow();
    }
  });

  it("factories accept custom id and version arguments", () => {
    const p = createLegacyVisualProfile("shop-a-v3", 3);
    expect(p.id).toBe("shop-a-v3");
    expect(p.version).toBe(3);
  });

  it("returns a fresh instance each call (safe to mutate)", () => {
    const a = createLegacyVisualProfile();
    const b = createLegacyVisualProfile();
    a.toeKick.heightMm = 200;
    expect(b.toeKick.heightMm).toBe(89);
  });
});
