// Phase 2 resolvers — family / front / drawer.
//
// Pure, Prisma-agnostic. Callers pass in already-loaded rows keyed by
// scope + the resolved metadata bags for Organization/Project/Room and
// the cabinet's own parameters. This mirrors the Phase 1 pattern where
// the merger (`mergeProfileFields`) is a pure function and the API
// route handles the DB IO.

import type { CabinetType } from "../../types/cabinet";
import {
  CABINET_DISABLE_FAMILY_RULE_KEY,
  type CabinetFamilyRuleRow,
  type CabinetSystemAssignments,
  type DrawerSystemResolution,
  type DrawerSystemRow,
  type FamilyResolution,
  type FamilyResolutionSource,
  type FrontSystemResolution,
  type FrontSystemRow,
  type SystemResolutionSource,
} from "./types";

// ─── Same-org read-time tenancy helper ─────────────────────────────────────

/** Returns the row IFF it belongs to ctxOrgId; otherwise null. Never
 *  throws. Used at every resolver hit so cross-org stale references
 *  silently fall through to the next scope. */
export function assertSameOrg<T extends { orgId: string }>(
  row: T | null | undefined,
  ctxOrgId: string,
): T | null {
  if (!row) return null;
  if (row.orgId !== ctxOrgId) return null;
  return row;
}

// ─── Cabinet.parameters helpers ────────────────────────────────────────────

function readCabinetSystemRef(
  params: Record<string, unknown> | null | undefined,
  key: "familyRuleId" | "frontSystemId" | "drawerSystemId",
): string | null {
  if (!params) return null;
  const v = params[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function isFamilyRuleDisabled(
  params: Record<string, unknown> | null | undefined,
): boolean {
  if (!params) return false;
  return params[CABINET_DISABLE_FAMILY_RULE_KEY] === true;
}

// ─── Family-rule resolution ────────────────────────────────────────────────

export interface FamilyResolverInput {
  ctxOrgId: string;
  cabinetType: CabinetType;
  cabinetParams: Record<string, unknown> | null | undefined;

  /** Rule referenced by cabinet.parameters.familyRuleId (already looked
   *  up; MUST be same-org or null). */
  cabinetRule: CabinetFamilyRuleRow | null;

  /** Assignments read from each higher scope's metadata bag. */
  roomAssignments: CabinetSystemAssignments | null;
  projectAssignments: CabinetSystemAssignments | null;
  organizationAssignments: CabinetSystemAssignments | null;

  /** Rules resolved from each scope's map (already looked up; MUST be
   *  same-org or null). */
  roomRule: CabinetFamilyRuleRow | null;
  projectRule: CabinetFamilyRuleRow | null;
  organizationRule: CabinetFamilyRuleRow | null;
}

/**
 * Resolves the effective CabinetFamilyRule.
 *
 * Order:
 *   1. If cabinet.parameters.disableFamilyRule === true →
 *      { rule: null, status: "disabled", source: "cabinet_disabled" }.
 *      NO further scopes are consulted.
 *   2. cabinet.parameters.familyRuleId (if present + same-org).
 *   3. Room.metadata.cabinetSystemAssignments.familyRuleIdsByCabinetType[cabinetType].
 *   4. Project.metadata.cabinetSystemAssignments.familyRuleIdsByCabinetType[cabinetType].
 *   5. Organization.metadata.cabinetSystemAssignments.familyRuleIdsByCabinetType[cabinetType].
 *   6. Otherwise → { rule: null, status: "unresolved", source: "none" }.
 *
 * Read-time same-org tenancy is enforced by the caller (via
 * `assertSameOrg`) before rows are handed to this function — a
 * cross-org row must arrive here as `null`.
 */
export function resolveCabinetFamilyRule(input: FamilyResolverInput): FamilyResolution {
  if (isFamilyRuleDisabled(input.cabinetParams)) {
    return { rule: null, status: "disabled", source: "cabinet_disabled" };
  }

  const cabinetRefId = readCabinetSystemRef(input.cabinetParams, "familyRuleId");
  if (cabinetRefId && input.cabinetRule) {
    return { rule: input.cabinetRule, status: "resolved", source: "cabinet" };
  }

  const scopes: Array<[FamilyResolutionSource, CabinetFamilyRuleRow | null]> = [
    ["room", input.roomRule],
    ["project", input.projectRule],
    ["organization", input.organizationRule],
  ];
  for (const [source, rule] of scopes) {
    if (rule) return { rule, status: "resolved", source };
  }
  return { rule: null, status: "unresolved", source: "none" };
}

/** Extracts the family-rule ID for a cabinet type from a scope's
 *  assignments bag. Returns null when unassigned or unknown-shaped. */
export function pickFamilyRuleIdForType(
  assignments: CabinetSystemAssignments | null | undefined,
  cabinetType: CabinetType,
): string | null {
  if (!assignments) return null;
  const map = assignments.familyRuleIdsByCabinetType;
  if (!map) return null;
  const v = map[cabinetType];
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ─── Front-system resolution ───────────────────────────────────────────────

export interface FrontSystemResolverInput {
  ctxOrgId: string;
  cabinetParams: Record<string, unknown> | null | undefined;

  cabinetSystem: FrontSystemRow | null;
  roomSystem: FrontSystemRow | null;
  projectSystem: FrontSystemRow | null;
  organizationSystem: FrontSystemRow | null;
}

export function resolveFrontSystem(input: FrontSystemResolverInput): FrontSystemResolution {
  const cabinetRefId = readCabinetSystemRef(input.cabinetParams, "frontSystemId");
  if (cabinetRefId && input.cabinetSystem) {
    return { system: input.cabinetSystem, status: "resolved", source: "cabinet" };
  }
  const scopes: Array<[SystemResolutionSource, FrontSystemRow | null]> = [
    ["room", input.roomSystem],
    ["project", input.projectSystem],
    ["organization", input.organizationSystem],
  ];
  for (const [source, system] of scopes) {
    if (system) return { system, status: "resolved", source };
  }
  return { system: null, status: "unresolved", source: "none" };
}

// ─── Drawer-system resolution ──────────────────────────────────────────────

export interface DrawerSystemResolverInput {
  ctxOrgId: string;
  cabinetParams: Record<string, unknown> | null | undefined;

  cabinetSystem: DrawerSystemRow | null;
  roomSystem: DrawerSystemRow | null;
  projectSystem: DrawerSystemRow | null;
  organizationSystem: DrawerSystemRow | null;
}

export function resolveDrawerSystem(input: DrawerSystemResolverInput): DrawerSystemResolution {
  const cabinetRefId = readCabinetSystemRef(input.cabinetParams, "drawerSystemId");
  if (cabinetRefId && input.cabinetSystem) {
    return { system: input.cabinetSystem, status: "resolved", source: "cabinet" };
  }
  const scopes: Array<[SystemResolutionSource, DrawerSystemRow | null]> = [
    ["room", input.roomSystem],
    ["project", input.projectSystem],
    ["organization", input.organizationSystem],
  ];
  for (const [source, system] of scopes) {
    if (system) return { system, status: "resolved", source };
  }
  return { system: null, status: "unresolved", source: "none" };
}
