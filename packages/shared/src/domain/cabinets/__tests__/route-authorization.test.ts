import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { canAssignCabinetSystems, canManageOrganizationStandards } from "../../systems/authz";

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.1a final authorization patch.
//
// The API middleware authenticates (JWT → x-user-role) but enforces no
// role policy — every mutation handler must guard itself. These routes
// previously had NO role check, so a viewer could mutate/destroy data:
//
//   · DELETE cabinet                     (requested)
//   · POST   revisions (create snapshot) (requested)
//   · DELETE room    — cascades every cabinet in the room
//   · DELETE project — cascades rooms/cabinets/parts/revisions
//     (both fixed under the "immediately equivalent destructive
//      viewer-access" exception — strict supersets of cabinet DELETE)
//
// Cabinet DELETE / Revision POST / Room DELETE use the existing
// cabinet-mutation predicate (owner/admin/designer allowed, viewer →
// 403). Project DELETE is administrative: owner/admin only via the
// existing owner/admin predicate (designer + viewer → 403).
//
// No HTTP harness in the shared package — as with the Phase 3.0 / 3.1a
// wiring tests, the route source is asserted: the guard lives INSIDE
// the handler and precedes every Prisma call in it.
// ═══════════════════════════════════════════════════════════════════════

describe("cabinet-mutation predicate — role matrix", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["designer", true],
    ["viewer", false],
    [undefined, false],
    [null, false],
    ["", false],
    ["superuser", false],
  ])("%s → %s", (role, allowed) => {
    expect(canAssignCabinetSystems(role as string | null | undefined)).toBe(allowed);
  });
});

const HERE = dirname(fileURLToPath(import.meta.url));
const API = resolve(HERE, "../../../../../../apps/api/src/app/api/projects");

function handlerBody(path: string, method: string): string {
  const src = readFileSync(path, "utf8");
  const start = src.indexOf(`export async function ${method}(`);
  expect(start, `${method} handler in ${path}`).toBeGreaterThanOrEqual(0);
  const next = src.indexOf("export async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

// Cabinet-mutation guard: owner/admin/designer allowed, viewer → 403.
const GUARDED: Array<[label: string, path: string, method: string]> = [
  ["Cabinet DELETE", resolve(API, "[id]/rooms/[roomId]/cabinets/[cabinetId]/route.ts"), "DELETE"],
  ["Revision POST", resolve(API, "[id]/revisions/route.ts"), "POST"],
  ["Room DELETE", resolve(API, "[id]/rooms/[roomId]/route.ts"), "DELETE"],
];

describe.each(GUARDED)("%s — viewer denied before any DB access", (_label, path, method) => {
  const body = handlerBody(path, method);

  it("reads the caller role from the request context", () => {
    expect(body).toMatch(/const \{[^}]*\brole\b[^}]*\} = getContext\(req\)/);
  });

  it("guards with the shared cabinet-mutation predicate → 403 FORBIDDEN", () => {
    expect(body).toMatch(
      /if \(!canAssignCabinetSystems\(role\)\) \{\s*return apiError\(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE\);/,
    );
  });

  it("the guard precedes every Prisma call (no destructive mutation / lookup first)", () => {
    const guard = body.indexOf("canAssignCabinetSystems(role)");
    const firstPrisma = body.search(/\bprisma\.|\bfind[A-Z]\w*\(/);
    expect(guard).toBeGreaterThan(0);
    expect(firstPrisma).toBeGreaterThan(guard);
  });
});

describe("Room DELETE — designer mutation rights (working design model)", () => {
  it.each([["owner", true], ["admin", true], ["designer", true], ["viewer", false]])(
    "%s → %s",
    (role, allowed) => {
      expect(canAssignCabinetSystems(role)).toBe(allowed);
    },
  );
});

// Project DELETE is an administrative, job-level action — owner/admin
// only via the existing owner/admin predicate. Designers are denied.
describe("Project DELETE — owner/admin only", () => {
  const body = handlerBody(resolve(API, "[id]/route.ts"), "DELETE");

  it.each([["owner", true], ["admin", true], ["designer", false], ["viewer", false], [undefined, false]])(
    "%s → %s",
    (role, allowed) => {
      expect(canManageOrganizationStandards(role as string | undefined)).toBe(allowed);
    },
  );

  it("guards with the owner/admin predicate (NOT the designer-inclusive one) → 403 FORBIDDEN", () => {
    expect(body).toMatch(
      /if \(!canManageOrganizationStandards\(role\)\) \{\s*return apiError\("Only owners and admins can delete projects\.", 403, FORBIDDEN_CODE\);/,
    );
    expect(body).not.toContain("canAssignCabinetSystems");
  });

  it("the guard precedes every Prisma call", () => {
    const guard = body.indexOf("canManageOrganizationStandards(role)");
    expect(guard).toBeGreaterThan(0);
    expect(body.search(/\bprisma\./)).toBeGreaterThan(guard);
  });
});

describe("unchanged semantics beyond authorization", () => {
  it("Cabinet DELETE still 404s outside tenancy and deletes by id", () => {
    const body = handlerBody(resolve(API, "[id]/rooms/[roomId]/cabinets/[cabinetId]/route.ts"), "DELETE");
    expect(body).toMatch(/if \(!existing\) return apiError\("Cabinet not found", 404\)/);
    expect(body).toMatch(/prisma\.cabinet\.delete\(\{ where: \{ id: params\.cabinetId \} \}\)/);
  });

  it("Revision POST still snapshots rooms → cabinets → parts verbatim", () => {
    const body = handlerBody(resolve(API, "[id]/revisions/route.ts"), "POST");
    expect(body).toMatch(/include: \{\s*cabinets: \{\s*include: \{ parts: true \}/);
    expect(body).toMatch(/snapshot: snapshot as never/);
  });
});
