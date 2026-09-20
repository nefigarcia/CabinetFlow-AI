// Client-side authorization for Phase 2 / 2.1 cabinet-systems surfaces.
// Thin re-export of the shared predicates — same source of truth as
// apps/api/src/lib/authz.ts. Server remains authoritative; these
// predicates only control UI convenience (hidden buttons, disabled
// inputs). A user who bypasses the client still hits 403 at the API.

export {
  canAssignCabinetSystems,
  canManageOrganizationStandards,
  canReadCabinetSystems,
} from "@woodcraft/shared";
