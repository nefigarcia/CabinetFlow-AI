import { describe, expect, it } from "vitest";
import {
  cabinetInteriorComponentsArraySchema,
  type CabinetInteriorComponent,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 correction §2 — array-level duplicate-ID rejection.
//
// Component `id` is stable identity for edit / remove / enable-toggle
// / reorder / revision restore / future AI ops. Duplicate IDs silently
// break every one of those. The array-level schema rejects outright;
// there is no silent dedup, no ID regeneration, no keep-first/last.
// ═══════════════════════════════════════════════════════════════════════

const c = (id: string, over: Partial<CabinetInteriorComponent> = {}): CabinetInteriorComponent =>
  ({ id, enabled: true, type: "spice_rack", ...over }) as CabinetInteriorComponent;

describe("Duplicate component IDs — rejected outright", () => {
  it("unique IDs → VALID", () => {
    const arr = [c("a"), c("b"), c("c")];
    expect(cabinetInteriorComponentsArraySchema.safeParse(arr).success).toBe(true);
  });

  it("duplicate IDs same type → REJECTED", () => {
    const arr = [c("dup"), c("dup")];
    const parsed = cabinetInteriorComponentsArraySchema.safeParse(arr);
    expect(parsed.success).toBe(false);
  });

  it("duplicate IDs DIFFERENT types → REJECTED", () => {
    const arr = [
      c("dup", { type: "rollout" }),
      c("dup", { type: "hidden_drawer" }),
    ];
    expect(cabinetInteriorComponentsArraySchema.safeParse(arr).success).toBe(false);
  });

  it("duplicate IDs with one disabled → STILL REJECTED (identity is identity regardless of state)", () => {
    const arr = [
      c("dup", { type: "utensil_divider" }),
      c("dup", { type: "utensil_divider", enabled: false }),
    ];
    expect(cabinetInteriorComponentsArraySchema.safeParse(arr).success).toBe(false);
  });

  it("three duplicates of same id → REJECTED (2 issues emitted)", () => {
    const arr = [c("x"), c("x"), c("x")];
    const parsed = cabinetInteriorComponentsArraySchema.safeParse(arr);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      // At least one Zod issue points at the duplicate path.
      const paths = parsed.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("id"))).toBe(true);
    }
  });

  it("error message names the duplicate id + both indexes", () => {
    const arr = [c("a"), c("b"), c("a")];
    const parsed = cabinetInteriorComponentsArraySchema.safeParse(arr);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toContain("duplicate component id 'a'");
      expect(msgs).toContain("indexes 0 and 2");
    }
  });

  it("no silent deduplication — parse returns exactly the input length on success", () => {
    const arr = [c("a"), c("b"), c("c")];
    const parsed = cabinetInteriorComponentsArraySchema.parse(arr);
    expect(parsed.length).toBe(3);
  });
});
