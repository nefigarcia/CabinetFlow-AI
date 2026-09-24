import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { gateCabinetParametersWrite, type CabinetParameterRefLookup } from "../";
import { canAssignCabinetSystems } from "../../systems/authz";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.1a — canonical Cabinet.parameters write gate, shared by
// Cabinet POST + Cabinet PATCH. Before 3.1a, POST persisted
// `z.record(z.any())` with no interior validation, no role check and no
// profile/system tenancy checks.
// ═══════════════════════════════════════════════════════════════════════

const ORG = "org-a";
const OTHER = "org-b";

/** In-memory lookup. Rows are keyed by id; each lookup mimics the
 *  Prisma `where: { id, orgId }` scoping. Records every call. */
function fakeLookup(rows: Record<string, { orgId: string; cabinetType?: string }>) {
  const calls: string[] = [];
  const find = (kind: string) => async (id: string, orgId: string) => {
    calls.push(`${kind}:${id}`);
    const r = rows[id];
    return r && r.orgId === orgId ? { id, orgId: r.orgId, cabinetType: r.cabinetType ?? "base" } : null;
  };
  const lookup: CabinetParameterRefLookup = {
    constructionProfile: find("construction"),
    materialProfile: find("material"),
    hardwareProfile: find("hardware"),
    familyRule: find("family"),
    frontSystem: find("front"),
    drawerSystem: find("drawer"),
  };
  return { lookup, calls };
}

const ROWS = {
  cp1: { orgId: ORG },
  cpX: { orgId: OTHER },
  frBase: { orgId: ORG, cabinetType: "base" },
  frWall: { orgId: ORG, cabinetType: "wall" },
  frX: { orgId: OTHER, cabinetType: "base" },
  fs1: { orgId: ORG },
  fsX: { orgId: OTHER },
  ds1: { orgId: ORG },
  dsX: { orgId: OTHER },
};

const gate = (parameters: Record<string, unknown> | undefined, extra: { existingParameters?: Record<string, unknown> } = {}) =>
  gateCabinetParametersWrite({
    orgId: ORG,
    cabinetType: "base",
    parameters,
    lookup: fakeLookup(ROWS).lookup,
    ...extra,
  });

describe("gateCabinetParametersWrite — structural (same helper as PATCH)", () => {
  it("valid parameters pass through sanitized", async () => {
    const r = await gate({ doorCount: 2, interiorComponents: [{ id: "a", enabled: true, type: "rollout" }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parameters).toEqual({ doorCount: 2, interiorComponents: [{ id: "a", enabled: true, type: "rollout" }] });
  });

  it.each([
    ["fake type", [{ id: "x", enabled: true, type: "totally_fake" }]],
    ["duplicate ids", [{ id: "d", enabled: true, type: "rollout" }, { id: "d", enabled: true, type: "rollout" }]],
    ["cross-type field", [{ id: "x", enabled: true, type: "hidden_drawer", bins: 2 }]],
    ["missing required", [{ id: "x", enabled: true, type: "trash_pullout" }]],
  ])("malformed interiorComponents (%s) → 422 VALIDATION_ERROR", async (_label, arr) => {
    const r = await gate({ interiorComponents: arr });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.code).toBe("VALIDATION_ERROR");
    }
  });

  it("null interiorComponents → 422", async () => {
    const r = await gate({ interiorComponents: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("definitionId on create (no stored parameters) → 422", async () => {
    const r = await gate({ interiorComponents: [{ id: "l", enabled: true, type: "rollout", definitionId: "d1" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.error).toMatch(/definitionId/);
    }
  });

  it("update with an unreadable stored array + interiorComponents write → 409", async () => {
    const r = await gate(
      { interiorComponents: [] },
      { existingParameters: { interiorComponents: [{ id: "x", type: "future" }] } },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
  });

  it("no parameters → ok(undefined), no lookups", async () => {
    const f = fakeLookup(ROWS);
    const r = await gateCabinetParametersWrite({ orgId: ORG, cabinetType: "base", parameters: undefined, lookup: f.lookup });
    expect(r).toEqual({ ok: true, parameters: undefined });
    expect(f.calls).toEqual([]);
  });
});

describe("gateCabinetParametersWrite — tenancy (matches PATCH semantics)", () => {
  it("same-org profile + system refs → ok", async () => {
    const r = await gate({ constructionProfileId: "cp1", familyRuleId: "frBase", frontSystemId: "fs1", drawerSystemId: "ds1" });
    expect(r.ok).toBe(true);
  });

  it("cross-org profile → uniform 404 'Profile not found'", async () => {
    const r = await gate({ constructionProfileId: "cpX" });
    expect(r).toEqual({ ok: false, status: 404, error: "Profile not found" });
  });

  it("nonexistent material / hardware profile → 404", async () => {
    expect((await gate({ materialProfileId: "nope" })).ok).toBe(false);
    expect((await gate({ hardwareProfileId: "nope" })).ok).toBe(false);
  });

  it.each([["familyRuleId", "frX"], ["frontSystemId", "fsX"], ["drawerSystemId", "dsX"]])(
    "cross-org %s → uniform 404 'Not found'",
    async (key, id) => {
      const r = await gate({ [key]: id });
      expect(r).toEqual({ ok: false, status: 404, error: "Not found" });
    },
  );

  it("family rule for another cabinetType → 422", async () => {
    const r = await gate({ familyRuleId: "frWall" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.error).toMatch(/targets cabinetType='wall' but this cabinet is type='base'/);
    }
  });

  it("null / empty refs (deletions) skip the lookup", async () => {
    const f = fakeLookup(ROWS);
    const r = await gateCabinetParametersWrite({
      orgId: ORG,
      cabinetType: "base",
      parameters: { constructionProfileId: null, familyRuleId: "", frontSystemId: null },
      lookup: f.lookup,
    });
    expect(r.ok).toBe(true);
    expect(f.calls).toEqual([]);
  });

  it("interior validation runs BEFORE any tenancy lookup", async () => {
    const f = fakeLookup(ROWS);
    await gateCabinetParametersWrite({
      orgId: ORG,
      cabinetType: "base",
      parameters: { constructionProfileId: "cp1", interiorComponents: [{ id: "x", type: "fake", enabled: true }] },
      lookup: f.lookup,
    });
    expect(f.calls).toEqual([]);
  });
});

// ─── Role semantics shared by POST / PATCH / restore ───────────────────

describe("cabinet-mutation role predicate", () => {
  it.each([["owner", true], ["admin", true], ["designer", true], ["viewer", false], [undefined, false], ["", false]])(
    "%s → %s",
    (role, allowed) => {
      expect(canAssignCabinetSystems(role as string | undefined)).toBe(allowed);
    },
  );
});

// ─── Route-level wiring (no HTTP harness — assert source, as in 3.0) ───

const HERE = dirname(fileURLToPath(import.meta.url));
const API = resolve(HERE, "../../../../../../apps/api/src/app/api/projects/[id]");
const POST_PATH = resolve(API, "rooms/[roomId]/cabinets/route.ts");
const PATCH_PATH = resolve(API, "rooms/[roomId]/cabinets/[cabinetId]/route.ts");
const RESTORE_PATH = resolve(API, "revisions/[revisionId]/restore/route.ts");

function handlerBody(src: string, method: string): string {
  const start = src.indexOf(`export async function ${method}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = src.indexOf("export async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("Cabinet POST wiring", () => {
  const post = handlerBody(readFileSync(POST_PATH, "utf8"), "POST");

  it("enforces cabinet-mutation role before any DB work", () => {
    const roleIdx = post.indexOf("canAssignCabinetSystems(role)");
    expect(roleIdx).toBeGreaterThan(0);
    expect(roleIdx).toBeLessThan(post.indexOf("assertRoom("));
    expect(post).toMatch(/apiError\(FORBIDDEN_MESSAGE_ASSIGN,\s*403,\s*FORBIDDEN_CODE\)/);
  });

  it("runs the shared gate on the incoming parameters with NO stored parameters (fail-closed)", () => {
    expect(post).toMatch(/gateCabinetParametersWrite\s*\(\s*\{[^}]*parameters:\s*parsed\.data\.parameters/s);
    const call = post.slice(post.indexOf("gateCabinetParametersWrite("), post.indexOf("if (!gate.ok)"));
    expect(call).not.toContain("existingParameters");
    expect(post).toMatch(/if \(!gate\.ok\) return apiError\(gate\.error, gate\.status, gate\.code\)/);
  });

  it("gates BEFORE creating the row, and persists the SANITIZED parameters", () => {
    expect(post.indexOf("gateCabinetParametersWrite(")).toBeLessThan(post.indexOf("prisma.cabinet.create("));
    expect(post).toMatch(/parameters:\s*gate\.parameters/);
  });
});

describe("Cabinet PATCH wiring", () => {
  const patch = handlerBody(readFileSync(PATCH_PATH, "utf8"), "PATCH");
  it("role check, then gate with stored parameters, then update", () => {
    expect(patch.indexOf("canAssignCabinetSystems(role)")).toBeLessThan(patch.indexOf("gateCabinetParametersWrite("));
    expect(patch).toMatch(/existingParameters,/);
    expect(patch.indexOf("gateCabinetParametersWrite(")).toBeLessThan(patch.indexOf("prisma.cabinet.update("));
  });
});

describe("Revision restore wiring", () => {
  const src = readFileSync(RESTORE_PATH, "utf8");
  const post = handlerBody(src, "POST");

  it("viewer is forbidden — role check precedes every DB read/write", () => {
    const roleIdx = post.indexOf("canAssignCabinetSystems(role)");
    expect(roleIdx).toBeGreaterThan(0);
    expect(roleIdx).toBeLessThan(post.indexOf("prisma."));
    expect(post).toMatch(/apiError\(FORBIDDEN_MESSAGE_ASSIGN,\s*403,\s*FORBIDDEN_CODE\)/);
  });

  it("historical parameters are restored verbatim — never re-validated or normalized", () => {
    expect(post).toMatch(/parameters:\s*cab\.parameters as any,/);
    expect(src).not.toMatch(/gateCabinetParametersWrite|validateIncomingCabinetParameters|cabinetInteriorComponent|readInteriorComponentsSafe|applyCabinetParametersPatch/);
  });
});
