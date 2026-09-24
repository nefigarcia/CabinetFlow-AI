// Server-side resolver for the Phase 2 effective-systems bundle for a
// given cabinet. Composes the pure resolvers in
// packages/shared/src/domain/systems + the Phase 1 effective-profile
// resolver into a single payload for the Cabinet Inspector.
//
// Manufacturing boundary: NEVER touches compileUnit, CAD service,
// syncParts, DXF, CNC, sheet nesting, G-code, or calculateHardwareBom.

import { prisma } from "@/lib/prisma";
import {
  CABINET_DISABLE_FAMILY_RULE_KEY,
  HARDWARE_FIELDS,
  ProfileInheritance,
  assertSameOrg,
  evaluateInteriorComponentsReadiness,
  isDrawerSystemRelevant,
  pickFamilyRuleIdForType,
  readAssignmentsFromMetadata,
  readInteriorComponentsSafe,
  resolveCabinetFamilyRule,
  resolveDrawerSystem,
  resolveFrontSystem,
  resolveHardwareRequirements,
  type CabinetFamilyRuleRow,
  type DrawerSystemResolution,
  type DrawerSystemRow,
  type FamilyResolution,
  type FrontSystemResolution,
  type FrontSystemRow,
  type HardwareResolutionOutput,
  type InteriorReadinessIssue,
  type Phase2ReadinessCode,
} from "@woodcraft/shared";
import type { CabinetType } from "@woodcraft/shared";
import { buildEffectiveProfileForCabinet } from "@/lib/effective-profile";
import {
  normalizeCabinetFamilyRuleRow,
  normalizeDrawerSystemRow,
} from "@/lib/systems";

export interface EffectiveSystemsPayload {
  family: FamilyResolution;
  front:  FrontSystemResolution;
  drawer: DrawerSystemResolution;
  hardware: HardwareResolutionOutput;
  readiness: Array<{
    code: Phase2ReadinessCode;
    severity: "warning";
    detail: string;
  }>;
  /** Phase 3.0 — SEPARATE from Phase 2 `readiness`. The
   *  InteriorComponentsSection renders its own summary; the Systems
   *  section stays untouched. Never merge these two arrays. */
  interiorReadiness: InteriorReadinessIssue[];
}

export async function buildEffectiveSystemsForCabinet(input: {
  orgId: string;
  projectId: string;
  roomId: string;
  cabinetType: CabinetType;
  cabinetParameters: Record<string, unknown> | null;
}): Promise<EffectiveSystemsPayload> {
  const params = input.cabinetParameters ?? {};

  const [org, project, room] = await Promise.all([
    prisma.organization.findUnique({ where: { id: input.orgId }, select: { metadata: true } }),
    prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId }, select: { metadata: true } }),
    prisma.room.findFirst({ where: { id: input.roomId, orgId: input.orgId }, select: { metadata: true } }),
  ]);

  const organizationAssignments = readAssignmentsFromMetadata(org?.metadata);
  const projectAssignments      = readAssignmentsFromMetadata(project?.metadata);
  const roomAssignments         = readAssignmentsFromMetadata(room?.metadata);

  // ─── Family rule ─────────────────────────────────────────────────
  const cabinetFamilyId = typeof params.familyRuleId === "string" ? params.familyRuleId : null;
  const isDisabled = params[CABINET_DISABLE_FAMILY_RULE_KEY] === true;

  // Determine IDs at each higher scope (per cabinetType). Only the
  // matching cabinet-type entry is consulted; other types ignored.
  const orgFamilyId     = pickFamilyRuleIdForType(organizationAssignments, input.cabinetType);
  const projectFamilyId = pickFamilyRuleIdForType(projectAssignments,      input.cabinetType);
  const roomFamilyId    = pickFamilyRuleIdForType(roomAssignments,         input.cabinetType);

  // Load rows for the IDs we might use. Same-org WHERE enforced. If
  // disabled, none of these are needed — skip the DB round-trip.
  let cabinetRule: CabinetFamilyRuleRow | null = null;
  let roomRule:    CabinetFamilyRuleRow | null = null;
  let projectRule: CabinetFamilyRuleRow | null = null;
  let orgRule:     CabinetFamilyRuleRow | null = null;

  if (!isDisabled) {
    const idsToLoad = [cabinetFamilyId, roomFamilyId, projectFamilyId, orgFamilyId]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const uniqueIds = Array.from(new Set(idsToLoad));
    if (uniqueIds.length > 0) {
      const rows = await prisma.cabinetFamilyRule.findMany({
        where: { id: { in: uniqueIds }, orgId: input.orgId },
      });
      const byId = new Map<string, unknown>();
      for (const r of rows) byId.set(r.id, normalizeCabinetFamilyRuleRow(r));

      const pick = (id: string | null): CabinetFamilyRuleRow | null => {
        if (!id) return null;
        return (assertSameOrg(byId.get(id) as (CabinetFamilyRuleRow & { orgId: string }) | null, input.orgId) ?? null) as CabinetFamilyRuleRow | null;
      };
      cabinetRule = pick(cabinetFamilyId);
      roomRule    = pick(roomFamilyId);
      projectRule = pick(projectFamilyId);
      orgRule     = pick(orgFamilyId);
    }
  }

  const family = resolveCabinetFamilyRule({
    ctxOrgId: input.orgId,
    cabinetType: input.cabinetType,
    cabinetParams: params,
    cabinetRule,
    roomAssignments,
    projectAssignments,
    organizationAssignments,
    roomRule,
    projectRule,
    organizationRule: orgRule,
  });

  // ─── Front system ────────────────────────────────────────────────
  const cabinetFrontId = typeof params.frontSystemId === "string" ? params.frontSystemId : null;
  const orgFrontId     = organizationAssignments?.preferredFrontSystemId ?? null;
  const projectFrontId = projectAssignments?.preferredFrontSystemId ?? null;
  const roomFrontId    = roomAssignments?.preferredFrontSystemId ?? null;

  const frontRows = await loadFrontSystemsByIds([
    cabinetFrontId, roomFrontId, projectFrontId, orgFrontId,
  ], input.orgId);
  const front = resolveFrontSystem({
    ctxOrgId: input.orgId,
    cabinetParams: params,
    cabinetSystem:      pickFrontSystem(frontRows, cabinetFrontId, input.orgId),
    roomSystem:         pickFrontSystem(frontRows, roomFrontId,    input.orgId),
    projectSystem:      pickFrontSystem(frontRows, projectFrontId, input.orgId),
    organizationSystem: pickFrontSystem(frontRows, orgFrontId,     input.orgId),
  });

  // ─── Drawer system ───────────────────────────────────────────────
  const cabinetDrawerId = typeof params.drawerSystemId === "string" ? params.drawerSystemId : null;
  const orgDrawerId     = organizationAssignments?.preferredDrawerSystemId ?? null;
  const projectDrawerId = projectAssignments?.preferredDrawerSystemId ?? null;
  const roomDrawerId    = roomAssignments?.preferredDrawerSystemId ?? null;

  const drawerRows = await loadDrawerSystemsByIds([
    cabinetDrawerId, roomDrawerId, projectDrawerId, orgDrawerId,
  ], input.orgId);
  const drawer = resolveDrawerSystem({
    ctxOrgId: input.orgId,
    cabinetParams: params,
    cabinetSystem:      pickDrawerSystem(drawerRows, cabinetDrawerId, input.orgId),
    roomSystem:         pickDrawerSystem(drawerRows, roomDrawerId,    input.orgId),
    projectSystem:      pickDrawerSystem(drawerRows, projectDrawerId, input.orgId),
    organizationSystem: pickDrawerSystem(drawerRows, orgDrawerId,     input.orgId),
  });

  // ─── Hardware resolution ─────────────────────────────────────────
  const effectiveProfile = await buildEffectiveProfileForCabinet({
    orgId: input.orgId,
    projectId: input.projectId,
    roomId: input.roomId,
    cabinetParameters: input.cabinetParameters,
  });

  const effHardware: Record<string, unknown> = effectiveProfile.hardware.effective ?? {};
  const effectiveHardwareTyped: Partial<{
    hingeManufacturer: string | null;
    hingeSoftClose: boolean | null;
    hingeSystem: string | null;
    drawerSlideManufacturer: string | null;
    drawerSlideSoftClose: boolean | null;
    drawerSlideSystem: string | null;
  }> = {};
  for (const f of HARDWARE_FIELDS) {
    (effectiveHardwareTyped as Record<string, unknown>)[f] = effHardware[f] ?? null;
  }

  const hardware = resolveHardwareRequirements({
    cabinetType: input.cabinetType,
    cabinetParams: params,
    frontSystem: front.system,
    drawerSystem: drawer.system,
    effectiveHardware: effectiveHardwareTyped,
    cabinetFamilyRule: family.rule
      ? { cornerVariant: family.rule.cornerVariant }
      : null,
  });

  // Counts used by BOTH readiness relevance + uncommon-combo detection.
  const doorCount = readPositiveInt(params, "doorCount");
  const drawerCount = readPositiveInt(params, "drawerCount");
  void doorCount;

  // ─── Readiness codes ─────────────────────────────────────────────
  const readiness: EffectiveSystemsPayload["readiness"] = [];
  if (family.status === "unresolved") {
    readiness.push({
      code: "CABINET_FAMILY_RULE_UNRESOLVED",
      severity: "warning",
      detail: `No family rule resolved for cabinetType='${input.cabinetType}'.`,
    });
  }
  if (front.status === "unresolved") {
    readiness.push({
      code: "FRONT_SYSTEM_UNRESOLVED",
      severity: "warning",
      detail: "No front system resolved.",
    });
  }
  // DRAWER_SYSTEM_UNRESOLVED only fires when a drawer system is
  // ACTUALLY relevant for this cabinet — otherwise a plain base cabinet
  // with drawerCount=0 would surface a meaningless warning. The
  // relevance predicate is the SAME one the Inspector uses to decide
  // whether to render the drawer assignment control.
  if (drawer.status === "unresolved") {
    const drawerRelevant = isDrawerSystemRelevant({
      cabinetType: input.cabinetType,
      drawerCount,
      cabinetParams: params,
      roomAssignments,
      projectAssignments,
      organizationAssignments,
    });
    if (drawerRelevant) {
      readiness.push({
        code: "DRAWER_SYSTEM_UNRESOLVED",
        severity: "warning",
        detail: "No drawer system resolved.",
      });
    }
  }
  for (const r of hardware.readiness) {
    readiness.push({ code: r.code, severity: "warning", detail: r.detail });
  }

  // ─── SYSTEM_UNCOMMON_COMBO — non-blocking flags for unusual pairings ───
  // Warning-only. Do NOT auto-correct or block PATCHes.
  const isDrawerCabinet =
    input.cabinetType === "drawer_base" || drawerCount > 0;
  if (front.system && input.cabinetType === "drawer_base" &&
      (front.system.kind === "hinged_single" || front.system.kind === "hinged_double")) {
    readiness.push({
      code: "SYSTEM_UNCOMMON_COMBO",
      severity: "warning",
      detail: `Front '${front.system.kind}' on a drawer_base cabinet is unusual — verify intent.`,
    });
  }
  if (drawer.system && !isDrawerCabinet) {
    readiness.push({
      code: "SYSTEM_UNCOMMON_COMBO",
      severity: "warning",
      detail: `Drawer system '${drawer.system.name}' assigned but this cabinet has drawerCount=${drawerCount}${input.cabinetType !== "drawer_base" ? ` and type='${input.cabinetType}'` : ""}.`,
    });
  }
  if (front.system && front.system.role === "appliance_panel" && front.system.kind === "bifold") {
    readiness.push({
      code: "SYSTEM_UNCOMMON_COMBO",
      severity: "warning",
      detail: "Front role='appliance_panel' combined with kind='bifold' is unusual — verify intent.",
    });
  }

  // ─── Phase 3.0 — interior components readiness (SEPARATE) ─────────
  // Emitted as a distinct field so the Systems section presentation is
  // untouched. UI reads `interiorReadiness` from the same endpoint.
  const shelfCount = readPositiveInt(params, "shelfCount");
  // Read-only consumer: an unreadable stored value yields no interior
  // readiness (the Inspector renders its own "cannot be safely read"
  // state from the cabinet payload). Never treated as an editable [].
  const interiorRead = readInteriorComponentsSafe(params);
  const interiorReadiness =
    interiorRead.status === "ok"
      ? evaluateInteriorComponentsReadiness({
          cabinet: {
            cabinetType: input.cabinetType,
            doorCount,
            drawerCount,
            shelfCount,
          },
          components: interiorRead.components,
        })
      : [];

  return {
    family,
    front,
    drawer,
    hardware,
    readiness,
    interiorReadiness,
  };
}

function readPositiveInt(
  params: Record<string, unknown> | null | undefined,
  key: string,
): number {
  if (!params) return 0;
  const v = params[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function loadFrontSystemsByIds(
  ids: Array<string | null>,
  orgId: string,
): Promise<Map<string, FrontSystemRow>> {
  const uniq = Array.from(new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0)));
  const map = new Map<string, FrontSystemRow>();
  if (uniq.length === 0) return map;
  const rows = await prisma.frontSystem.findMany({ where: { id: { in: uniq }, orgId } });
  for (const r of rows) map.set(r.id, r as unknown as FrontSystemRow);
  return map;
}

function pickFrontSystem(
  map: Map<string, FrontSystemRow>,
  id: string | null,
  orgId: string,
): FrontSystemRow | null {
  if (!id) return null;
  const row = map.get(id);
  if (!row) return null;
  return assertSameOrg(row as FrontSystemRow & { orgId: string }, orgId) ?? null;
}

async function loadDrawerSystemsByIds(
  ids: Array<string | null>,
  orgId: string,
): Promise<Map<string, DrawerSystemRow>> {
  const uniq = Array.from(new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0)));
  const map = new Map<string, DrawerSystemRow>();
  if (uniq.length === 0) return map;
  const rows = await prisma.drawerSystem.findMany({ where: { id: { in: uniq }, orgId } });
  for (const r of rows) {
    const normalized = normalizeDrawerSystemRow(r) as unknown as DrawerSystemRow;
    map.set(r.id, normalized);
  }
  return map;
}

function pickDrawerSystem(
  map: Map<string, DrawerSystemRow>,
  id: string | null,
  orgId: string,
): DrawerSystemRow | null {
  if (!id) return null;
  const row = map.get(id);
  if (!row) return null;
  return assertSameOrg(row as DrawerSystemRow & { orgId: string }, orgId) ?? null;
}
