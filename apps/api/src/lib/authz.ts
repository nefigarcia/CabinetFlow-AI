// Server-side authorization for Phase 2 / 2.1 cabinet-systems surfaces.
// Thin re-export of the shared predicates in
// packages/shared/src/domain/systems/authz.ts — single source of truth
// for server + client. See that file for policy documentation.

export {
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
  FORBIDDEN_MESSAGE_MANAGE_STANDARDS,
  canAssignCabinetSystems,
  canManageOrganizationStandards,
  canReadCabinetSystems,
} from "@woodcraft/shared";

export type Role = "owner" | "admin" | "designer" | "viewer";
