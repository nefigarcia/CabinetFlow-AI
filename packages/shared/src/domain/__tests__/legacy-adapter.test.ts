import { describe, expect, it } from "vitest";
import { adaptLegacyCabinet, adaptLegacyPart } from "../adapters/legacy-cabinet";
import {
  ALL_LEGACY_CABINETS,
  legacyCabinetWithManualPart,
  legacyFramelessBase,
  legacySinkBase,
} from "./fixtures";

describe("legacy Cabinet adapter", () => {
  it("preserves identity, dimensions, and position", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    expect(design.id).toBe(legacyFramelessBase.id);
    expect(design.type).toBe(legacyFramelessBase.type);
    expect(design.name).toBe(legacyFramelessBase.name);
    expect(design.position).toEqual({
      x: legacyFramelessBase.posX,
      y: legacyFramelessBase.posY,
      z: legacyFramelessBase.posZ,
    });
    expect(design.dimensions).toEqual({
      widthMm: legacyFramelessBase.width,
      heightMm: legacyFramelessBase.height,
      depthMm: legacyFramelessBase.depth,
    });
  });

  it("maps known intent keys into typed parameters", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    expect(design.parameters.role).toBe("cabinet");
    expect(design.parameters.doorCount).toBe(1);
    expect(design.parameters.finishStyle).toBe("gloss-white");
  });

  it("preserves unknown legacy parameter keys in BOTH extra and legacyParameters", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    expect(design.parameters.extra).toBeDefined();
    expect(design.parameters.extra!["hingeType"]).toBe("blum-clip-top");
    expect(design.parameters.extra!["ecabsExportedAt"]).toBeDefined();
    expect(design.legacyParameters).toBeDefined();
    expect(design.legacyParameters!["hingeType"]).toBe("blum-clip-top");
  });

  it("does not put known intent keys into extra / legacyParameters", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    expect(design.parameters.extra).not.toHaveProperty("role");
    expect(design.parameters.extra).not.toHaveProperty("doorCount");
    expect(design.legacyParameters).not.toHaveProperty("role");
  });

  it("preserves unknown sink-base parameter keys (plumbingClearance, hasFalseFront)", () => {
    const design = adaptLegacyCabinet(legacySinkBase);
    expect(design.parameters.extra!["plumbingClearance"]).toBe(100);
    expect(design.parameters.extra!["hasFalseFront"]).toBe(true);
  });

  it("marks manual parts with generationMode='manual' and generated parts with 'generated'", () => {
    const design = adaptLegacyCabinet(legacyCabinetWithManualPart);
    const modes = design.parts.map((p) => p.generationMode);
    expect(modes).toContain("manual");
    expect(modes).toContain("generated");
    const manualPart = design.parts.find((p) => p.id === "m_custom")!;
    expect(manualPart.generationMode).toBe("manual");
    expect(manualPart.partType).toBe("custom");
  });

  it("preserves cutParams verbatim in legacyCutParams", () => {
    const design = adaptLegacyCabinet(legacyCabinetWithManualPart);
    const manualPart = design.parts.find((p) => p.id === "m_custom")!;
    expect(manualPart.legacyCutParams).toEqual({ note: "Trimmed on-site" });
  });

  it("preserves assemblyGroup in legacyMetadata for adapted parts", () => {
    const design = adaptLegacyCabinet(legacyFramelessBase);
    for (const part of design.parts) {
      expect(part.legacyMetadata).toBeDefined();
      expect(part.legacyMetadata!["assemblyGroup"]).toBe("carcass");
    }
  });

  it("adapts every fixture cabinet without throwing", () => {
    for (const cabinet of ALL_LEGACY_CABINETS) {
      expect(() => adaptLegacyCabinet(cabinet)).not.toThrow();
    }
  });

  it("preserves the count of parts through adaptation", () => {
    for (const cabinet of ALL_LEGACY_CABINETS) {
      const design = adaptLegacyCabinet(cabinet);
      expect(design.parts.length).toBe(cabinet.parts.length);
    }
  });
});

describe("adaptLegacyPart", () => {
  it("returns generationMode='generated' for isManual=false", () => {
    const part = legacyFramelessBase.parts[0]!;
    expect(adaptLegacyPart(part).generationMode).toBe("generated");
  });

  it("returns generationMode='manual' for isManual=true", () => {
    const manual = legacyCabinetWithManualPart.parts.find(
      (p) => p.isManual,
    )!;
    expect(adaptLegacyPart(manual).generationMode).toBe("manual");
  });

  it("carries through width/height/thickness as PartDimensionsMm", () => {
    const part = legacyFramelessBase.parts[0]!;
    const design = adaptLegacyPart(part);
    expect(design.dimensions).toEqual({
      widthMm: part.width,
      heightMm: part.height,
      thicknessMm: part.thickness,
    });
  });

  it("attaches materialProfileRef when materialId is present", () => {
    const part = { ...legacyFramelessBase.parts[0]!, materialId: "mat_1" };
    const design = adaptLegacyPart(part);
    expect(design.materialProfileRef).toEqual({ id: "mat_1", version: 1 });
  });

  it("omits materialProfileRef when materialId is null", () => {
    const part = { ...legacyFramelessBase.parts[0]!, materialId: null };
    const design = adaptLegacyPart(part);
    expect(design.materialProfileRef).toBeUndefined();
  });
});
