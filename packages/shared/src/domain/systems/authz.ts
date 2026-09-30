// Phase 2.1 authorization predicates — SINGLE source of truth. Both
// apps/api/src/lib/authz.ts and apps/web/src/lib/authz.ts re-export
// these to guarantee server and client evaluate role permissions
// identically.
//
// Policy (locked to Phase 2.1 spec):
//   owner      → manage standards + assign
//   admin      → manage standards + assign
//   designer   → assign only (Project / Room / Cabinet)
//   viewer     → read-only
// Anything else → deny.

import type { UserRole } from "../../types/auth";

const OWNER_OR_ADMIN: ReadonlySet<UserRole> = new Set<UserRole>(["owner", "admin"]);
const OWNER_ADMIN_DESIGNER: ReadonlySet<UserRole> = new Set<UserRole>([
  "owner",
  "admin",
  "designer",
]);

function normalize(role: string | null | undefined): UserRole | null {
  if (role === "owner" || role === "admin" || role === "designer" || role === "viewer") {
    return role;
  }
  return null;
}

/** Owner/admin: CREATE + EDIT system definitions AND change org defaults. */
export function canManageOrganizationStandards(role: string | null | undefined): boolean {
  const r = normalize(role);
  return r !== null && OWNER_OR_ADMIN.has(r);
}

/** Owner/admin/designer: assign systems at Project / Room / Cabinet scope. */
export function canAssignCabinetSystems(role: string | null | undefined): boolean {
  const r = normalize(role);
  return r !== null && OWNER_ADMIN_DESIGNER.has(r);
}

/** Anyone authenticated may read the systems catalog. Kept for symmetry. */
export function canReadCabinetSystems(role: string | null | undefined): boolean {
  return normalize(role) !== null;
}

// ─── Authorization hardening — app-wide semantic predicates ───────────
//
// Same two role tiers as above, named for the domains beyond cabinet
// systems. HTTP handlers only — internal CAD/system writes (e.g. parts
// regeneration) are never role-gated.

/** Owner/admin/designer: mutate working design content — projects,
 *  rooms, manual cabinet parts, scene-asset placements, quotes,
 *  installer feedback, and design-tool executions (validate,
 *  sketch-to-cad, CNC export). Viewers are read-only. */
export function canMutateDesignContent(role: string | null | undefined): boolean {
  const r = normalize(role);
  return r !== null && OWNER_ADMIN_DESIGNER.has(r);
}

/** Owner/admin: create/edit/delete organization-wide reusable libraries
 *  — Phase 1 profiles, materials, hardware, machine profiles, and
 *  org-scoped scene-asset definitions. */
export function canManageOrganizationLibrary(role: string | null | undefined): boolean {
  const r = normalize(role);
  return r !== null && OWNER_OR_ADMIN.has(r);
}

/** Quote statuses that record a financial decision (existing enum values). */
export const QUOTE_DECISION_STATUSES: ReadonlySet<string> = new Set(["accepted", "rejected"]);

/** May `role` move a quote from `from` to `to`? Transitions INTO a
 *  decision status are owner/admin; everything else (incl. `sent`, and
 *  re-sending the current status) follows canMutateDesignContent. */
export function canTransitionQuoteStatus(
  role: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!canMutateDesignContent(role)) return false;
  if (to == null || to === from || !QUOTE_DECISION_STATUSES.has(to)) return true;
  return canManageOrganizationStandards(role);
}

export const FORBIDDEN_CODE = "FORBIDDEN";
export const FORBIDDEN_MESSAGE_QUOTE_DECISION =
  "Only owners and admins can mark a quote accepted or rejected.";
export const FORBIDDEN_MESSAGE_MANAGE_LIBRARY =
  "Only owners and admins can manage organization libraries and standards.";
export const FORBIDDEN_MESSAGE_MANAGE_STANDARDS =
  "Only owners and admins can manage cabinet-system definitions or organization defaults.";
export const FORBIDDEN_MESSAGE_ASSIGN =
  "This action requires owner, admin, or designer role.";
