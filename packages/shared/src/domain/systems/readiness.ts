// Phase 2.1 patch — readiness-emission relevance predicates.
//
// The effective-systems endpoint had a bug where DRAWER_SYSTEM_UNRESOLVED
// fired for every cabinet whose drawer resolution returned status
// "unresolved" — including plain base cabinets with drawerCount=0 that
// have no reason to care about a drawer system at all.
//
// This module contains the SINGLE relevance predicate used by the server
// readiness emitter AND by the client Inspector's drawer-visibility
// logic, so the two stay in lockstep.
//
// A drawer system is RELEVANT for a cabinet when ANY of:
//   1. drawerCount > 0
//   2. cabinet.type === "drawer_base"
//   3. Cabinet.parameters.drawerSystemId is stored (explicit override)
//   4. an inherited preferredDrawerSystemId is set at Room/Project/Org
//      (so the resolver would attempt to surface something)
//
// If none of the above hold, drawer-system readiness is suppressed —
// the drawer system is genuinely irrelevant to this cabinet.

import type { CabinetType } from "../../types/cabinet";
import type { CabinetSystemAssignments } from "./types";

export interface DrawerRelevanceInput {
  cabinetType: CabinetType;
  drawerCount: number;
  cabinetParams: Record<string, unknown> | null | undefined;
  roomAssignments: CabinetSystemAssignments | null | undefined;
  projectAssignments: CabinetSystemAssignments | null | undefined;
  organizationAssignments: CabinetSystemAssignments | null | undefined;
}

export function isDrawerSystemRelevant(input: DrawerRelevanceInput): boolean {
  if (input.drawerCount > 0) return true;
  if (input.cabinetType === "drawer_base") return true;

  const explicitCabinet = input.cabinetParams?.["drawerSystemId"];
  if (typeof explicitCabinet === "string" && explicitCabinet.length > 0) return true;

  if (typeof input.roomAssignments?.preferredDrawerSystemId === "string") return true;
  if (typeof input.projectAssignments?.preferredDrawerSystemId === "string") return true;
  if (typeof input.organizationAssignments?.preferredDrawerSystemId === "string") return true;

  return false;
}
