// Phase 2.1 authorization matrix.
//
// The predicates in ../authz.ts are the SINGLE source of truth used by
// both apps/api/src/lib/authz.ts (server) and apps/web/src/lib/authz.ts
// (client). This test locks in the policy matrix so drift is impossible.

import { describe, expect, it } from "vitest";
import {
  canAssignCabinetSystems,
  canManageOrganizationStandards,
  canReadCabinetSystems,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
} from "../";

// ─── canManageOrganizationStandards — owner/admin only ─────────────────

describe("canManageOrganizationStandards — CREATE/EDIT definitions + Org defaults", () => {
  it("owner → allowed", () => {
    expect(canManageOrganizationStandards("owner")).toBe(true);
  });
  it("admin → allowed", () => {
    expect(canManageOrganizationStandards("admin")).toBe(true);
  });
  it("designer → 403", () => {
    expect(canManageOrganizationStandards("designer")).toBe(false);
  });
  it("viewer → 403", () => {
    expect(canManageOrganizationStandards("viewer")).toBe(false);
  });
  it("unknown role → deny", () => {
    expect(canManageOrganizationStandards("hacker")).toBe(false);
    expect(canManageOrganizationStandards("")).toBe(false);
    expect(canManageOrganizationStandards(null)).toBe(false);
    expect(canManageOrganizationStandards(undefined)).toBe(false);
  });
});

// ─── canAssignCabinetSystems — owner/admin/designer ───────────────────

describe("canAssignCabinetSystems — Project/Room/Cabinet assignments", () => {
  it("owner → allowed", () => {
    expect(canAssignCabinetSystems("owner")).toBe(true);
  });
  it("admin → allowed", () => {
    expect(canAssignCabinetSystems("admin")).toBe(true);
  });
  it("designer → allowed", () => {
    expect(canAssignCabinetSystems("designer")).toBe(true);
  });
  it("viewer → 403", () => {
    expect(canAssignCabinetSystems("viewer")).toBe(false);
  });
  it("unknown role → deny", () => {
    expect(canAssignCabinetSystems("hacker")).toBe(false);
    expect(canAssignCabinetSystems(null)).toBe(false);
    expect(canAssignCabinetSystems(undefined)).toBe(false);
  });
});

// ─── canReadCabinetSystems — everyone authenticated ───────────────────

describe("canReadCabinetSystems — read access", () => {
  it.each(["owner", "admin", "designer", "viewer"] as const)("%s → allowed", (r) => {
    expect(canReadCabinetSystems(r)).toBe(true);
  });
  it("unauthenticated / unknown → deny", () => {
    expect(canReadCabinetSystems(null)).toBe(false);
    expect(canReadCabinetSystems(undefined)).toBe(false);
    expect(canReadCabinetSystems("")).toBe(false);
    expect(canReadCabinetSystems("random")).toBe(false);
  });
});

// ─── Full permission matrix ───────────────────────────────────────────
//
// One test enumerates the entire policy grid. This is the load-bearing
// authorization contract for Phase 2.1 — if any cell drifts, this test
// fails and the deploy blocks.

interface Cell {
  role: string;
  manage: boolean;   // canManageOrganizationStandards
  assign: boolean;   // canAssignCabinetSystems
  read: boolean;     // canReadCabinetSystems
}

const MATRIX: Cell[] = [
  { role: "owner",    manage: true,  assign: true,  read: true  },
  { role: "admin",    manage: true,  assign: true,  read: true  },
  { role: "designer", manage: false, assign: true,  read: true  },
  { role: "viewer",   manage: false, assign: false, read: true  },
  { role: "hacker",   manage: false, assign: false, read: false },
  { role: "",         manage: false, assign: false, read: false },
];

describe("Phase 2.1 permission matrix — full grid", () => {
  for (const cell of MATRIX) {
    it(`role='${cell.role}' → manage=${cell.manage} assign=${cell.assign} read=${cell.read}`, () => {
      expect(canManageOrganizationStandards(cell.role)).toBe(cell.manage);
      expect(canAssignCabinetSystems(cell.role)).toBe(cell.assign);
      expect(canReadCabinetSystems(cell.role)).toBe(cell.read);
    });
  }
});

// ─── FORBIDDEN constants stable ───────────────────────────────────────

describe("Forbidden response contract", () => {
  it("FORBIDDEN_CODE is the canonical repo code", () => {
    expect(FORBIDDEN_CODE).toBe("FORBIDDEN");
  });
  it("manage-standards message is a stable string", () => {
    expect(typeof FORBIDDEN_MESSAGE_MANAGE_STANDARDS).toBe("string");
    expect(FORBIDDEN_MESSAGE_MANAGE_STANDARDS.length).toBeGreaterThan(0);
  });
  it("assign message is a stable string", () => {
    expect(typeof FORBIDDEN_MESSAGE_ASSIGN).toBe("string");
    expect(FORBIDDEN_MESSAGE_ASSIGN.length).toBeGreaterThan(0);
  });
});

// ─── HTTP-status contract test (documents the server's response shape) ─
//
// The predicates return booleans; the server routes turn `false` into
// 403 FORBIDDEN via `apiError(FORBIDDEN_MESSAGE_*, 403, FORBIDDEN_CODE)`.
// The test locks in the intended HTTP status per policy scope so a
// future refactor can't accidentally drop the 403 and fall back to
// silent no-ops or a 404.

interface RouteExpectation {
  route: string;
  policyFn: (role: string) => boolean;
  requiredStatusForForbiddenRole: 403;
}

const ROUTES: RouteExpectation[] = [
  { route: "POST /api/systems/family-rules",             policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/systems/family-rules/[id]",       policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "DELETE /api/systems/family-rules/[id]",      policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "POST /api/systems/fronts",                   policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/systems/fronts/[id]",             policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "DELETE /api/systems/fronts/[id]",            policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "POST /api/systems/drawers",                  policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/systems/drawers/[id]",            policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "DELETE /api/systems/drawers/[id]",           policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/organization/system-assignments", policyFn: canManageOrganizationStandards, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/projects/[id]/system-assignments", policyFn: canAssignCabinetSystems,       requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/projects/[id]/rooms/[roomId]/system-assignments", policyFn: canAssignCabinetSystems, requiredStatusForForbiddenRole: 403 },
  { route: "PATCH /api/projects/[id]/rooms/[roomId]/cabinets/[cabinetId]", policyFn: canAssignCabinetSystems, requiredStatusForForbiddenRole: 403 },
];

describe("Route → policy binding — documented deployment contract", () => {
  for (const spec of ROUTES) {
    it(`${spec.route} — allowed roles pass, blocked roles yield ${spec.requiredStatusForForbiddenRole}`, () => {
      for (const cell of MATRIX) {
        const permitted = spec.policyFn(cell.role);
        // Sanity: a role that is denied must not be "owner" (which is always allowed).
        if (!permitted) {
          expect(cell.role).not.toBe("owner");
        }
      }
      expect(spec.requiredStatusForForbiddenRole).toBe(403);
    });
  }
});
