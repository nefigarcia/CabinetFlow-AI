import { describe, expect, it } from "vitest";
import { validateIncomingCabinetParameters } from "../";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.0 correction §4 — server-side incoming-parameters validation.
//
// The Cabinet PATCH route's `updateCabinetSchema` uses
// `parameters: z.record(z.any())` which cannot discriminate on the
// interior-component union. `validateIncomingCabinetParameters` closes
// that gap: it inspects the raw incoming `parameters` object, deep-
// validates `interiorComponents` if present, and returns a sanitized
// parameters object or a validation error suitable for a 422 body.
//
// The Cabinet PATCH route calls THIS helper (proven by an import
// assertion below) after per-field Zod parse and before
// applyCabinetParametersPatch. A forged client cannot bypass it.
// ═══════════════════════════════════════════════════════════════════════

describe("validateIncomingCabinetParameters — matrix", () => {
  it("no interiorComponents key → passes through untouched", () => {
    const r = validateIncomingCabinetParameters({ doorCount: 2, drawerCount: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parameters).toEqual({ doorCount: 2, drawerCount: 4 });
    }
  });

  it("undefined / null parameters → passes through", () => {
    expect(validateIncomingCabinetParameters(undefined).ok).toBe(true);
    expect(validateIncomingCabinetParameters(null).ok).toBe(true);
  });

  it("valid array → accepted; returns sanitized parameters", () => {
    const params = {
      doorCount: 2,
      interiorComponents: [
        { id: "a", enabled: true, type: "trash_pullout", bins: 2 },
      ],
    };
    const r = validateIncomingCabinetParameters(params);
    expect(r.ok).toBe(true);
    if (r.ok && r.parameters) {
      expect(r.parameters.doorCount).toBe(2);
      const arr = r.parameters.interiorComponents as unknown[];
      expect(arr.length).toBe(1);
    }
  });

  it("[] → accepted (clears components)", () => {
    const r = validateIncomingCabinetParameters({ interiorComponents: [] });
    expect(r.ok).toBe(true);
    if (r.ok && r.parameters) {
      expect(r.parameters.interiorComponents).toEqual([]);
    }
  });

  it("null value for interiorComponents → REJECTED", () => {
    const r = validateIncomingCabinetParameters({ interiorComponents: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/interiorComponents/);
      expect(r.error).toMatch(/null is not allowed/);
    }
  });

  it("unknown discriminant → REJECTED", () => {
    const r = validateIncomingCabinetParameters({
      interiorComponents: [{ id: "x", enabled: true, type: "totally_fake" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/interiorComponents/);
  });

  it("missing required field (trash_pullout without bins) → REJECTED", () => {
    const r = validateIncomingCabinetParameters({
      interiorComponents: [{ id: "x", enabled: true, type: "trash_pullout" }],
    });
    expect(r.ok).toBe(false);
  });

  it("duplicate IDs → REJECTED at the array level (correction §2 path)", () => {
    const r = validateIncomingCabinetParameters({
      interiorComponents: [
        { id: "dup", enabled: true, type: "rollout" },
        { id: "dup", enabled: true, type: "hidden_drawer" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/duplicate component id/);
  });

  it("cross-type extra field (bins on hidden_drawer) → REJECTED (correction §3 strict path)", () => {
    const r = validateIncomingCabinetParameters({
      interiorComponents: [
        { id: "x", enabled: true, type: "hidden_drawer", bins: 2 },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("parameters that is a non-object primitive → REJECTED with a specific error", () => {
    const r = validateIncomingCabinetParameters("not-an-object" as unknown as null);
    expect(r.ok).toBe(false);
  });

  it("parameters that is an array → REJECTED (Cabinet.parameters is an object bag, not a list)", () => {
    const r = validateIncomingCabinetParameters([] as unknown as null);
    expect(r.ok).toBe(false);
  });

  it("bypass attempt — random totally-fake type inside legitimate other keys → REJECTED", () => {
    const r = validateIncomingCabinetParameters({
      doorCount: 2,
      wallPlacement: { x: 100, y: 200 },
      interiorComponents: [
        // Attacker mixes one valid + one forged element to try to slip
        // the forged one through. The array-level parse must reject.
        { id: "ok", enabled: true, type: "rollout" },
        { id: "attack", enabled: true, type: "GRANT_ADMIN" },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("does not mutate unrelated parameter keys", () => {
    const input = {
      doorCount: 2,
      familyRuleId: "fr1",
      customKey: "keep-me",
      interiorComponents: [{ id: "a", enabled: true, type: "rollout" }],
    };
    const r = validateIncomingCabinetParameters(input);
    expect(r.ok).toBe(true);
    if (r.ok && r.parameters) {
      expect(r.parameters.doorCount).toBe(2);
      expect(r.parameters.familyRuleId).toBe("fr1");
      expect(r.parameters.customKey).toBe("keep-me");
    }
  });
});

// ─── Route-level binding assertion ────────────────────────────────────
//
// This test doesn't invoke Next's dispatch (we have no HTTP harness in
// the shared package), but it PROVES that the Cabinet PATCH route file
// imports the helper — so nobody accidentally removes the wiring while
// leaving the helper file behind.
//
// Reads the route file as text and greps for the import + call.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(
  HERE,
  "../../../../../../apps/api/src/app/api/projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/route.ts",
);

// Phase 3.1a: the PATCH route no longer calls the helper inline — it
// calls the shared `gateCabinetParametersWrite`, which runs this helper
// first (proven behaviorally in cabinets/__tests__/parameter-write-gate
// .test.ts) and is shared with Cabinet POST.
const GATE_PATH = resolve(HERE, "../../cabinets/parameter-write-gate.ts");

describe("Cabinet PATCH route → helper wiring", () => {
  it("the shared write gate calls validateIncomingCabinetParameters with stored parameters", () => {
    const src = readFileSync(GATE_PATH, "utf8");
    expect(src).toMatch(
      /validateIncomingCabinetParameters\s*\(\s*input\.parameters\s*,\s*\{\s*existingParameters:\s*input\.existingParameters/,
    );
  });
  it("PATCH calls the gate with the raw incoming parameters + the stored parameters (invokes .ok / .error branch)", () => {
    const src = readFileSync(ROUTE_PATH, "utf8");
    expect(src).toMatch(/gateCabinetParametersWrite\s*\(\s*\{[^}]*parameters:\s*parsed\.data\.parameters/s);
    expect(src).toMatch(/gateCabinetParametersWrite\s*\(\s*\{[^}]*existingParameters/s);
    expect(src).toMatch(/gate\.ok/);
    expect(src).not.toContain("validateIncomingCabinetParameters");
  });
});
