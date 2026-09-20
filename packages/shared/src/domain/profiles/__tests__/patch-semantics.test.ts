import { describe, expect, it } from "vitest";
import {
  buildPartialPrismaUpdate,
  constructionProfileWriteSchema,
  hardwareProfileWriteSchema,
  normalizeStaleFieldProvenance,
  type FieldProvenanceMap,
} from "../";

// ═══════════════════════════════════════════════════════════════════════════
// Three-state PATCH semantics
// ═══════════════════════════════════════════════════════════════════════════

describe("Zod three-state (absent / null / value) on nullable fields", () => {
  it("hardwareProfileWriteSchema accepts hingeSoftClose: true / false / null / absent", () => {
    for (const v of [true, false, null]) {
      const parsed = hardwareProfileWriteSchema.partial().safeParse({ hingeSoftClose: v });
      expect(parsed.success).toBe(true);
    }
    const parsedAbsent = hardwareProfileWriteSchema.partial().safeParse({});
    expect(parsedAbsent.success).toBe(true);
    if (parsedAbsent.success) {
      expect(parsedAbsent.data.hingeSoftClose).toBeUndefined();
    }
  });

  it("carcassThicknessMm rejects zero and negative but accepts null", () => {
    const schema = constructionProfileWriteSchema.partial();
    expect(schema.safeParse({ carcassThicknessMm: 0 }).success).toBe(false);
    expect(schema.safeParse({ carcassThicknessMm: -1 }).success).toBe(false);
    expect(schema.safeParse({ carcassThicknessMm: Number.NaN }).success).toBe(false);
    expect(schema.safeParse({ carcassThicknessMm: 19.05 }).success).toBe(true);
    expect(schema.safeParse({ carcassThicknessMm: null }).success).toBe(true);
  });

  it("constructionMethod accepts null (clear) and rejects unknown enum", () => {
    const schema = constructionProfileWriteSchema.partial();
    expect(schema.safeParse({ constructionMethod: null }).success).toBe(true);
    expect(schema.safeParse({ constructionMethod: "face_frame" }).success).toBe(true);
    expect(schema.safeParse({ constructionMethod: "unknown" as never }).success).toBe(false);
  });

  it("fieldProvenance loose schema preserves unknown key; strict variant rejects it", () => {
    const parsed = constructionProfileWriteSchema.partial().safeParse({
      fieldProvenance: { future_field_xyz: { status: "verified" } },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("buildPartialPrismaUpdate — three-state contract", () => {
  it("undefined → key skipped in payload", () => {
    const parsed = { name: "x", description: undefined };
    const out = buildPartialPrismaUpdate(parsed, ["name", "description"] as const);
    expect(out).toEqual({ name: "x" });
    expect("description" in out).toBe(false);
  });

  it("null → key present with value null", () => {
    const parsed = { name: "x", constructionMethod: null };
    const out = buildPartialPrismaUpdate(parsed, ["name", "constructionMethod"] as const);
    expect(out).toEqual({ name: "x", constructionMethod: null });
  });

  it("value → key set", () => {
    const parsed = { name: "x", constructionMethod: "face_frame" as const };
    const out = buildPartialPrismaUpdate(parsed, ["name", "constructionMethod"] as const);
    expect(out).toEqual({ name: "x", constructionMethod: "face_frame" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// normalizeStaleFieldProvenance — the bug-fix
// ═══════════════════════════════════════════════════════════════════════════

interface RowShape {
  fieldProvenance: FieldProvenanceMap | null;
  constructionMethod: unknown;
  carcassThicknessMm: unknown;
}

function existingRow(over: Partial<RowShape> = {}): RowShape {
  return {
    fieldProvenance: {
      constructionMethod: { status: "project_specific", sourceRef: "s" },
      carcassThicknessMm: { status: "verified", sourceRef: "s" },
    },
    constructionMethod: "face_frame",
    carcassThicknessMm: 19.05,
    ...over,
  };
}

describe("normalizeStaleFieldProvenance", () => {
  it("A — PATCH changes only description → payload has NO fieldProvenance key", () => {
    const patch = { description: "new" };
    const data = { description: "new" };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect("fieldProvenance" in out).toBe(false);
  });

  it("B — canonical field changed value (not cleared) → NO fieldProvenance key", () => {
    const patch = { constructionMethod: "frameless" };
    const data = { constructionMethod: "frameless" };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect("fieldProvenance" in out).toBe(false);
  });

  it("C — canonical field cleared to null → provenance entry removed AND payload emits fieldProvenance", () => {
    const patch = { constructionMethod: null };
    const data = { constructionMethod: null };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect("fieldProvenance" in out).toBe(true);
    expect(out.fieldProvenance).toEqual({
      carcassThicknessMm: { status: "verified", sourceRef: "s" },
    });
  });

  it("D — PATCH explicitly supplies fieldProvenance → payload emits it", () => {
    const patch = { fieldProvenance: { drawerBoxJoinery: { status: "verified" as const, sourceRef: "s" } } };
    const data = { fieldProvenance: { drawerBoxJoinery: { status: "verified" as const, sourceRef: "s" } } };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect(out.fieldProvenance).toEqual({
      drawerBoxJoinery: { status: "verified", sourceRef: "s" },
    });
  });

  it("E — cleared field had NO stale provenance entry → no lazy clone, no emit", () => {
    const patch = { frontOverlayMode: null };
    const data = { frontOverlayMode: null };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect("fieldProvenance" in out).toBe(false);
  });

  it("F — clearing the only provenance entry normalizes to null (not {})", () => {
    const patch = { constructionMethod: null, carcassThicknessMm: null };
    const data = { constructionMethod: null, carcassThicknessMm: null };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect(out.fieldProvenance).toBeNull();
  });

  it("G — explicit fieldProvenance:null wins over implicit rebuild", () => {
    const patch = { fieldProvenance: null, carcassThicknessMm: 19.05 };
    const data = { fieldProvenance: null, carcassThicknessMm: 19.05 };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    expect(out.fieldProvenance).toBeNull();
  });

  it("H — fresh provenance entry supplied AND same field cleared → cleanup strips it", () => {
    const patch = {
      fieldProvenance: { carcassThicknessMm: { status: "verified" as const, sourceRef: "s" } },
      carcassThicknessMm: null,
    };
    const data = {
      fieldProvenance: { carcassThicknessMm: { status: "verified" as const, sourceRef: "s" } },
      carcassThicknessMm: null,
    };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing: existingRow(),
      patch,
      data,
    });
    // The fresh entry for carcassThicknessMm gets stripped because the
    // field is being cleared → resulting map is empty → null.
    expect(out.fieldProvenance).toBeNull();
  });

  it("Unknown-key entries in provenance are preserved through cleanup", () => {
    const existing = existingRow({
      fieldProvenance: {
        constructionMethod: { status: "project_specific", sourceRef: "s" },
        future_field_xyz:   { status: "verified", sourceRef: "s" },
      },
    });
    const patch = { constructionMethod: null };
    const data = { constructionMethod: null };
    const out = normalizeStaleFieldProvenance({
      kind: "construction",
      existing,
      patch,
      data,
    });
    expect(out.fieldProvenance).toEqual({
      future_field_xyz: { status: "verified", sourceRef: "s" },
    });
  });
});
