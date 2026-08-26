import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATERIAL_ID_BY_CATEGORY,
  DEMO_MATERIAL_REGISTRY,
  findMaterial,
  materialsByCategory,
} from "../material-registry";
import { MATERIAL_CATEGORIES } from "../material-category";
import { materialRenderProfileSchema } from "../material-render-profile";

describe("MaterialRegistry (MVP demo catalog)", () => {
  it("every profile validates against the render-profile schema", () => {
    for (const p of DEMO_MATERIAL_REGISTRY) {
      expect(() => materialRenderProfileSchema.parse(p)).not.toThrow();
    }
  });

  it("every id is unique", () => {
    const ids = DEMO_MATERIAL_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every MaterialCategory required by the MVP", () => {
    for (const cat of MATERIAL_CATEGORIES) {
      const items = materialsByCategory(cat);
      expect(items.length, `${cat} should have at least one demo material`).toBeGreaterThan(0);
    }
  });

  it("findMaterial returns the profile by id, undefined otherwise", () => {
    const first = DEMO_MATERIAL_REGISTRY[0]!;
    expect(findMaterial(first.id)).toEqual(first);
    expect(findMaterial("does-not-exist")).toBeUndefined();
  });

  it("every category-default id resolves to an existing profile", () => {
    for (const [cat, id] of Object.entries(DEFAULT_MATERIAL_ID_BY_CATEGORY)) {
      const p = findMaterial(id);
      expect(p, `default for ${cat} = '${id}' should exist in the registry`).toBeDefined();
      expect(p!.category).toBe(cat);
    }
  });

  it("baseColorHex is always #rrggbb (six-digit hex)", () => {
    const RE = /^#[0-9a-fA-F]{6}$/;
    for (const p of DEMO_MATERIAL_REGISTRY) {
      expect(RE.test(p.baseColorHex), `${p.id}: ${p.baseColorHex}`).toBe(true);
    }
  });

  it("roughness and metalness are in [0, 1]", () => {
    for (const p of DEMO_MATERIAL_REGISTRY) {
      expect(p.roughness).toBeGreaterThanOrEqual(0);
      expect(p.roughness).toBeLessThanOrEqual(1);
      expect(p.metalness).toBeGreaterThanOrEqual(0);
      expect(p.metalness).toBeLessThanOrEqual(1);
    }
  });

  it("wood + floor + stone + backsplash profiles specify a scaleMm", () => {
    for (const p of DEMO_MATERIAL_REGISTRY) {
      if (["wood", "floor", "stone", "backsplash", "laminate"].includes(p.category)) {
        // laminate is allowed to be solid-color; others must specify a scale
        if (["wood", "floor", "stone", "backsplash"].includes(p.category)) {
          expect(p.scaleMm, `${p.id} (${p.category}) missing scaleMm`).toBeDefined();
        }
      }
    }
  });
});
