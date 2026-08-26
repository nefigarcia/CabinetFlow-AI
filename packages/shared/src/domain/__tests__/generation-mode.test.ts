import { describe, expect, it } from "vitest";
import {
  isFullyLocked,
  isFullyRegeneratable,
  isProtectedFromRegeneration,
  legacyIsManualFromGenerationMode,
  partGenerationModeFromLegacyIsManual,
  partGenerationModeSchema,
} from "../parts/generation-mode";

describe("PartGenerationMode legacy mapping", () => {
  it("isManual=false → generated", () => {
    expect(partGenerationModeFromLegacyIsManual(false)).toBe("generated");
  });

  it("isManual=true → manual", () => {
    expect(partGenerationModeFromLegacyIsManual(true)).toBe("manual");
  });

  it("manual and locked write back as isManual=true", () => {
    expect(legacyIsManualFromGenerationMode("manual")).toBe(true);
    expect(legacyIsManualFromGenerationMode("locked")).toBe(true);
  });

  it("generated and generated_override write back as isManual=false", () => {
    expect(legacyIsManualFromGenerationMode("generated")).toBe(false);
    expect(legacyIsManualFromGenerationMode("generated_override")).toBe(false);
  });
});

describe("PartGenerationMode guards", () => {
  it("isFullyRegeneratable is true only for 'generated'", () => {
    expect(isFullyRegeneratable("generated")).toBe(true);
    expect(isFullyRegeneratable("generated_override")).toBe(false);
    expect(isFullyRegeneratable("manual")).toBe(false);
    expect(isFullyRegeneratable("locked")).toBe(false);
  });

  it("isProtectedFromRegeneration is false only for 'generated'", () => {
    expect(isProtectedFromRegeneration("generated")).toBe(false);
    expect(isProtectedFromRegeneration("generated_override")).toBe(true);
    expect(isProtectedFromRegeneration("manual")).toBe(true);
    expect(isProtectedFromRegeneration("locked")).toBe(true);
  });

  it("isFullyLocked is true only for 'locked'", () => {
    expect(isFullyLocked("generated")).toBe(false);
    expect(isFullyLocked("generated_override")).toBe(false);
    expect(isFullyLocked("manual")).toBe(false);
    expect(isFullyLocked("locked")).toBe(true);
  });
});

describe("partGenerationModeSchema", () => {
  it("accepts all four canonical values", () => {
    for (const v of ["generated", "generated_override", "manual", "locked"] as const) {
      expect(partGenerationModeSchema.parse(v)).toBe(v);
    }
  });

  it("rejects unknown values", () => {
    expect(() => partGenerationModeSchema.parse("bogus")).toThrow();
    expect(() => partGenerationModeSchema.parse("")).toThrow();
  });
});
