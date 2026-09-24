import { describe, expect, it } from "vitest";
import {
  addInteriorComponent,
  cabinetInteriorComponentSchema,
  cabinetInteriorComponentsArraySchema,
  enforceInteriorComponentsWritePolicy,
  isLinkedInteriorComponent,
  readInteriorComponentsSafe,
  validateIncomingCabinetParameters,
  type CabinetInteriorComponent,
} from "../";
import { applyCabinetParametersPatch } from "../../cabinets";
import { doesParameterChangeRequireCadRecompute } from "../../cabinets/parameter-classification";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.1a — forward compatibility + write-path safety.
//
//   · Malformed stored data is UNREADABLE, never an editable [].
//   · `definitionId` is structurally READABLE (rollback target from
//     3.1b) but can never be CREATED / CHANGED / EDITED / REMOVED by a
//     3.1a write.
//   · Standalone (Phase 3.0) validation is unchanged.
// ═══════════════════════════════════════════════════════════════════════

const standalone = (id: string): CabinetInteriorComponent => ({
  id,
  enabled: true,
  type: "spice_rack",
});

/** A component as a 3.1b server would store it: linked, overrides only
 *  (no `bins` — the definition carries it). */
const LINKED_TRASH = {
  id: "linked-trash",
  type: "trash_pullout",
  definitionId: "clxdef000000000000000001",
  enabled: true,
  target: { kind: "cabinet" },
} as const;

// ─── Safe read ─────────────────────────────────────────────────────────

describe("readInteriorComponentsSafe", () => {
  it("valid [] → ok([])", () => {
    expect(readInteriorComponentsSafe({ interiorComponents: [] })).toEqual({ status: "ok", components: [] });
  });

  it("valid component array → ok(components)", () => {
    const arr = [standalone("a"), { id: "b", enabled: true, type: "trash_pullout", bins: 2 }];
    const r = readInteriorComponentsSafe({ interiorComponents: arr });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.components.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ONE malformed component among valid ones → unreadable, NOT []", () => {
    const raw = [standalone("a"), { id: "b", enabled: true, type: "trash_pullout" /* bins missing */ }];
    const r = readInteriorComponentsSafe({ interiorComponents: raw });
    expect(r.status).toBe("unreadable");
    expect("components" in r).toBe(false);
  });

  it("unreadable result carries the stored value by identity (never normalized)", () => {
    const raw = [{ id: "x", enabled: true, type: "future_type", extra: { deep: [1, 2] } }];
    const r = readInteriorComponentsSafe({ interiorComponents: raw });
    expect(r.status).toBe("unreadable");
    if (r.status === "unreadable") {
      expect(r.raw).toBe(raw);
      expect(r.error.length).toBeGreaterThan(0);
    }
  });

  it("duplicate ids in storage → unreadable (not silently de-duplicated)", () => {
    const r = readInteriorComponentsSafe({ interiorComponents: [standalone("d"), standalone("d")] });
    expect(r.status).toBe("unreadable");
  });

  it("mutation helpers cannot consume an unreadable read as []", () => {
    const stored = { interiorComponents: [standalone("keep"), { id: "bad", type: "nope" }] };
    const r = readInteriorComponentsSafe(stored);
    // The only way to reach an array is to narrow on status === "ok".
    const components = r.status === "ok" ? r.components : null;
    expect(components).toBeNull();

    // And even a client that fabricates [] and builds a whole-array
    // replacement is refused by the server-side policy (409) — the real
    // stored array is never overwritten.
    const next = addInteriorComponent([], standalone("new"));
    const v = validateIncomingCabinetParameters(
      { interiorComponents: next },
      { existingParameters: stored },
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(409);
  });

  it("stored value unreadable + patch WITHOUT interiorComponents → allowed; stored value untouched", () => {
    const storedRaw = [{ id: "bad", type: "nope" }];
    const stored = { doorCount: 2, interiorComponents: storedRaw };
    const v = validateIncomingCabinetParameters({ doorCount: 3 }, { existingParameters: stored });
    expect(v.ok).toBe(true);
    if (v.ok) {
      const merged = applyCabinetParametersPatch(stored, v.parameters);
      expect(merged.interiorComponents).toBe(storedRaw);
      expect(merged.doorCount).toBe(3);
    }
  });
});

// ─── definitionId structural compatibility ─────────────────────────────

describe("definitionId — structural READ compatibility", () => {
  it("a linked component with a non-empty definitionId parses (overrides only; no bins)", () => {
    const r = cabinetInteriorComponentSchema.safeParse(LINKED_TRASH);
    expect(r.success).toBe(true);
    if (r.success) expect(isLinkedInteriorComponent(r.data)).toBe(true);
  });

  it("a linked component may carry override fields of its own type", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({
        id: "r", type: "rollout", enabled: true, definitionId: "d1", quantity: 2,
      }).success,
    ).toBe(true);
  });

  it("linked custom does not require label (definition name is the fallback)", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({ id: "c", type: "custom", enabled: true, definitionId: "d1" }).success,
    ).toBe(true);
  });

  it("empty definitionId → rejected", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, definitionId: "" }).success).toBe(false);
  });

  it("definitionId longer than 191 → rejected", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, definitionId: "x".repeat(192) }).success,
    ).toBe(false);
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, definitionId: "x".repeat(191) }).success,
    ).toBe(true);
  });

  it("non-string / null definitionId → rejected (does not fall back to standalone)", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, definitionId: null }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, definitionId: 42 }).success).toBe(false);
  });

  it("linked components stay STRICT: cross-type keys are rejected", () => {
    expect(
      cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, type: "hidden_drawer", bins: 2 }).success,
    ).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, somethingElse: 1 }).success).toBe(false);
  });

  it("linked components still validate the values they DO carry", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, bins: 0 }).success).toBe(false);
    expect(cabinetInteriorComponentSchema.safeParse({ ...LINKED_TRASH, enabled: undefined }).success).toBe(false);
  });

  it("a stored array mixing standalone + linked components reads as ok (rollback target)", () => {
    const r = readInteriorComponentsSafe({ interiorComponents: [standalone("s"), LINKED_TRASH] });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.components.filter(isLinkedInteriorComponent).map((c) => c.id)).toEqual(["linked-trash"]);
  });
});

describe("Phase 3.0 standalone contract — unchanged", () => {
  it("standalone trash_pullout still requires bins (same Zod error path)", () => {
    const r = cabinetInteriorComponentSchema.safeParse({ id: "t", enabled: true, type: "trash_pullout" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("bins");
  });

  it("standalone custom still requires label", () => {
    expect(cabinetInteriorComponentSchema.safeParse({ id: "c", enabled: true, type: "custom" }).success).toBe(false);
  });

  it("unknown discriminant still reported on `type`, with array index prefix", () => {
    const r = cabinetInteriorComponentsArraySchema.safeParse([standalone("a"), { id: "b", enabled: true, type: "fake" }]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual([1, "type"]);
  });
});

// ─── Phase 3.1a write policy — no definitionId writes before 3.1b ──────

describe("write policy — definitionId cannot be created before 3.1b", () => {
  it("create path (no stored parameters) → any definitionId rejected (422)", () => {
    const v = validateIncomingCabinetParameters({ interiorComponents: [LINKED_TRASH] });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.status).toBe(422);
      expect(v.error).toMatch(/cannot be created or modified/);
    }
  });

  it("update adding a NEW linked component → rejected", () => {
    const v = validateIncomingCabinetParameters(
      { interiorComponents: [standalone("s"), LINKED_TRASH] },
      { existingParameters: { interiorComponents: [standalone("s")] } },
    );
    expect(v.ok).toBe(false);
  });

  it("update turning a standalone component into a linked one (same id) → rejected", () => {
    const v = validateIncomingCabinetParameters(
      { interiorComponents: [{ id: "s", enabled: true, type: "spice_rack", definitionId: "d1" }] },
      { existingParameters: { interiorComponents: [standalone("s")] } },
    );
    expect(v.ok).toBe(false);
  });

  it("CHANGED definitionId on an existing linked component → rejected", () => {
    const v = validateIncomingCabinetParameters(
      { interiorComponents: [{ ...LINKED_TRASH, definitionId: "other-def" }] },
      { existingParameters: { interiorComponents: [LINKED_TRASH] } },
    );
    expect(v.ok).toBe(false);
  });

  it("any EDIT to a linked component (override / enabled / target) → rejected", () => {
    const existing = { interiorComponents: [LINKED_TRASH] };
    for (const edited of [
      { ...LINKED_TRASH, bins: 3 },
      { ...LINKED_TRASH, enabled: false },
      { ...LINKED_TRASH, target: { kind: "drawer", index: 0 } },
    ]) {
      expect(validateIncomingCabinetParameters({ interiorComponents: [edited] }, { existingParameters: existing }).ok).toBe(false);
    }
  });

  it("REMOVING (or clearing) a stored linked component → rejected — never stripped", () => {
    const existing = { interiorComponents: [standalone("s"), LINKED_TRASH] };
    expect(validateIncomingCabinetParameters({ interiorComponents: [standalone("s")] }, { existingParameters: existing }).ok).toBe(false);
    expect(validateIncomingCabinetParameters({ interiorComponents: [] }, { existingParameters: existing }).ok).toBe(false);
  });

  it("stripping definitionId (flattening to standalone) → rejected", () => {
    const flattened = { id: LINKED_TRASH.id, type: "trash_pullout", enabled: true, bins: 2, target: { kind: "cabinet" } };
    const v = validateIncomingCabinetParameters(
      { interiorComponents: [flattened] },
      { existingParameters: { interiorComponents: [LINKED_TRASH] } },
    );
    expect(v.ok).toBe(false);
  });

  it("UNCHANGED linked component is preserved VERBATIM (stored raw object, not re-serialized)", () => {
    // Stored with a different key order than Zod's canonical output.
    const storedLinked = { target: { kind: "cabinet" }, enabled: true, definitionId: LINKED_TRASH.definitionId, type: "trash_pullout", id: LINKED_TRASH.id };
    const existing = { interiorComponents: [storedLinked, standalone("s")] };
    const v = validateIncomingCabinetParameters(
      { interiorComponents: [LINKED_TRASH, standalone("s"), standalone("new")] },
      { existingParameters: existing },
    );
    expect(v.ok).toBe(true);
    if (v.ok) {
      const arr = v.parameters!.interiorComponents as unknown[];
      expect(arr[0]).toBe(storedLinked);                       // identity — verbatim
      expect(JSON.stringify(arr[0])).toBe(JSON.stringify(storedLinked));
      expect((arr as CabinetInteriorComponent[]).map((c) => c.id)).toEqual(["linked-trash", "s", "new"]);
    }
  });

  it("policy is a pure function of (incoming, stored) — direct call matches", () => {
    const r = enforceInteriorComponentsWritePolicy({ incoming: [standalone("a")], existingParameters: undefined });
    expect(r).toEqual({ ok: true, components: [standalone("a")] });
  });
});

// ─── Manufacturing freeze ──────────────────────────────────────────────

describe("manufacturing freeze — definitionId lives inside a metadata-classified key", () => {
  it("a change confined to interiorComponents (incl. linked) never triggers CAD recompute", () => {
    const prev = { doorCount: 2, interiorComponents: [standalone("s")] };
    const next = { doorCount: 2, interiorComponents: [standalone("s"), LINKED_TRASH] };
    expect(doesParameterChangeRequireCadRecompute(prev, next)).toBe(false);
  });
});
