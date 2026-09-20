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

export const FORBIDDEN_CODE = "FORBIDDEN";
export const FORBIDDEN_MESSAGE_MANAGE_STANDARDS =
  "Only owners and admins can manage cabinet-system definitions or organization defaults.";
export const FORBIDDEN_MESSAGE_ASSIGN =
  "This action requires owner, admin, or designer role.";
