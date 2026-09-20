// Server-side helper that resolves the EFFECTIVE profile bundle for a
// given cabinet (Org → Project → Room → Cabinet.parameters). Consumed
// by the Cabinet inspector's Effective Profile section and by the
// readiness code emitter.

import { prisma } from "@/lib/prisma";
import {
  CONSTRUCTION_FIELDS,
  HARDWARE_FIELDS,
  MATERIAL_FIELDS,
  ProfileInheritance,
} from "@woodcraft/shared";

type ProfileSource = ProfileInheritance.ProfileSource;
type FieldProvenanceMap = ProfileInheritance.FieldProvenanceMap;

// Shape the inspector consumes. All fields present; values may be null.
export interface EffectiveProfilePayload {
  construction: {
    effective:    Record<string, unknown>;
    fieldSources: Record<string, ProfileSource>;
    profileIds:   Partial<Record<ProfileSource, string>>;
    fieldVerification: Record<string, unknown>;
  };
  material: {
    effective:    Record<string, unknown>;
    fieldSources: Record<string, ProfileSource>;
    profileIds:   Partial<Record<ProfileSource, string>>;
    fieldVerification: Record<string, unknown>;
  };
  hardware: {
    effective:    Record<string, unknown>;
    fieldSources: Record<string, ProfileSource>;
    profileIds:   Partial<Record<ProfileSource, string>>;
    fieldVerification: Record<string, unknown>;
  };
  gaps: { open: string[]; resolved: string[] };
  deferredCapabilities: ReturnType<typeof ProfileInheritance.effectiveDeferredCapabilities>;
  // Readiness codes emitted from the resolved bundle (non-blocking warnings).
  readiness: Array<{
    code: string;
    severity: "warning";
    scope: ProfileSource;
    kind?: "construction" | "material" | "hardware";
    detail: string;
    sourceRef?: string | null;
  }>;
}

interface ProfileRowsBundle {
  construction: Partial<Record<ProfileSource, {
    id: string;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string | null;
    fieldProvenance: FieldProvenanceMap | null;
    metadata: Record<string, unknown> | null;
  } & Record<string, unknown>>>;
  material: Partial<Record<ProfileSource, {
    id: string;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string | null;
    fieldProvenance: FieldProvenanceMap | null;
    metadata: Record<string, unknown> | null;
  } & Record<string, unknown>>>;
  hardware: Partial<Record<ProfileSource, {
    id: string;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string | null;
    fieldProvenance: FieldProvenanceMap | null;
    metadata: Record<string, unknown> | null;
  } & Record<string, unknown>>>;
}

/**
 * Loads all four scope's profile rows for the three kinds. Returns
 * ProfileRowsBundle keyed by (kind, source). Enforces same-org tenancy
 * at query time — a cabinet parameter referencing another org's
 * profile silently drops out of the bundle (defense in depth on top
 * of the assignment-time tenancy check).
 */
async function loadProfileRowsForCabinet(input: {
  orgId: string;
  projectId: string;
  roomId: string;
  cabinetParameters: Record<string, unknown> | null;
}): Promise<ProfileRowsBundle> {
  const [org, project, room] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.orgId },
      select: {
        defaultConstructionProfileId: true,
        defaultMaterialProfileId:     true,
        defaultHardwareProfileId:     true,
      },
    }),
    prisma.project.findFirst({
      where: { id: input.projectId, orgId: input.orgId },
      select: {
        constructionProfileId: true,
        materialProfileId:     true,
        hardwareProfileId:     true,
      },
    }),
    prisma.room.findFirst({
      where: { id: input.roomId, orgId: input.orgId },
      select: {
        constructionProfileId: true,
        materialProfileId:     true,
        hardwareProfileId:     true,
      },
    }),
  ]);

  const cabinetParams = input.cabinetParameters ?? {};
  const cabinetIds = {
    construction: typeof cabinetParams["constructionProfileId"] === "string"
      ? cabinetParams["constructionProfileId"] as string : null,
    material:     typeof cabinetParams["materialProfileId"] === "string"
      ? cabinetParams["materialProfileId"] as string : null,
    hardware:     typeof cabinetParams["hardwareProfileId"] === "string"
      ? cabinetParams["hardwareProfileId"] as string : null,
  };

  // Collect unique IDs per kind so we can bulk-fetch.
  function uniq(vals: Array<string | null | undefined>): string[] {
    return Array.from(new Set(vals.filter((v): v is string => typeof v === "string" && v.length > 0)));
  }
  const constructionIds = uniq([
    org?.defaultConstructionProfileId,
    project?.constructionProfileId,
    room?.constructionProfileId,
    cabinetIds.construction,
  ]);
  const materialIds = uniq([
    org?.defaultMaterialProfileId,
    project?.materialProfileId,
    room?.materialProfileId,
    cabinetIds.material,
  ]);
  const hardwareIds = uniq([
    org?.defaultHardwareProfileId,
    project?.hardwareProfileId,
    room?.hardwareProfileId,
    cabinetIds.hardware,
  ]);

  const [cRows, mRows, hRows] = await Promise.all([
    constructionIds.length
      ? prisma.constructionProfile.findMany({ where: { id: { in: constructionIds }, orgId: input.orgId } })
      : [],
    materialIds.length
      ? prisma.cabinetMaterialProfile.findMany({ where: { id: { in: materialIds }, orgId: input.orgId } })
      : [],
    hardwareIds.length
      ? prisma.hardwareProfile.findMany({ where: { id: { in: hardwareIds }, orgId: input.orgId } })
      : [],
  ]);

  const cById = new Map(cRows.map((r) => [r.id, r]));
  const mById = new Map(mRows.map((r) => [r.id, r]));
  const hById = new Map(hRows.map((r) => [r.id, r]));

  function pick<T>(map: Map<string, T>, id: string | null | undefined): T | undefined {
    return id ? map.get(id) : undefined;
  }

  // Convert a Prisma row (with Decimal columns) into a plain object the
  // resolver can consume. Decimal → number so JSON serialization works
  // and the merger's non-null check is straightforward.
  function normalizeCRow(row: unknown) {
    if (!row) return undefined;
    const r = row as Record<string, unknown>;
    return {
      ...r,
      carcassThicknessMm:         r.carcassThicknessMm != null ? Number(r.carcassThicknessMm) : null,
      drawerBoxThicknessMm:       r.drawerBoxThicknessMm != null ? Number(r.drawerBoxThicknessMm) : null,
      backThicknessMm:            r.backThicknessMm != null ? Number(r.backThicknessMm) : null,
      adjustableShelfThicknessMm: r.adjustableShelfThicknessMm != null ? Number(r.adjustableShelfThicknessMm) : null,
      nailerThicknessMm:          r.nailerThicknessMm != null ? Number(r.nailerThicknessMm) : null,
    };
  }
  function normalizeGeneric(row: unknown) {
    return row ? (row as Record<string, unknown>) : undefined;
  }

  return {
    construction: {
      organization: normalizeCRow(pick(cById, org?.defaultConstructionProfileId)) as never,
      project:      normalizeCRow(pick(cById, project?.constructionProfileId)) as never,
      room:         normalizeCRow(pick(cById, room?.constructionProfileId)) as never,
      cabinet:      normalizeCRow(pick(cById, cabinetIds.construction)) as never,
    },
    material: {
      organization: normalizeGeneric(pick(mById, org?.defaultMaterialProfileId)) as never,
      project:      normalizeGeneric(pick(mById, project?.materialProfileId)) as never,
      room:         normalizeGeneric(pick(mById, room?.materialProfileId)) as never,
      cabinet:      normalizeGeneric(pick(mById, cabinetIds.material)) as never,
    },
    hardware: {
      organization: normalizeGeneric(pick(hById, org?.defaultHardwareProfileId)) as never,
      project:      normalizeGeneric(pick(hById, project?.hardwareProfileId)) as never,
      room:         normalizeGeneric(pick(hById, room?.hardwareProfileId)) as never,
      cabinet:      normalizeGeneric(pick(hById, cabinetIds.hardware)) as never,
    },
  };
}

/** Builds the full Effective Profile payload for the inspector + readiness. */
export async function buildEffectiveProfileForCabinet(input: {
  orgId: string;
  projectId: string;
  roomId: string;
  cabinetParameters: Record<string, unknown> | null;
}): Promise<EffectiveProfilePayload> {
  const rows = await loadProfileRowsForCabinet(input);

  const scopes = ProfileInheritance.SCOPE_PRECEDENCE;

  const cMerged = ProfileInheritance.mergeProfileFields(CONSTRUCTION_FIELDS, scopes.map((s) => ({
    source: s, profile: (rows.construction[s] ?? null) as never,
  })));
  const mMerged = ProfileInheritance.mergeProfileFields(MATERIAL_FIELDS, scopes.map((s) => ({
    source: s, profile: (rows.material[s] ?? null) as never,
  })));
  const hMerged = ProfileInheritance.mergeProfileFields(HARDWARE_FIELDS, scopes.map((s) => ({
    source: s, profile: (rows.hardware[s] ?? null) as never,
  })));

  const cBySource = {} as Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
  const mBySource = {} as Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
  const hBySource = {} as Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>;
  for (const s of scopes) {
    if (rows.construction[s]) cBySource[s] = { fieldProvenance: (rows.construction[s]!.fieldProvenance ?? null) as never };
    if (rows.material[s])     mBySource[s] = { fieldProvenance: (rows.material[s]!.fieldProvenance ?? null) as never };
    if (rows.hardware[s])     hBySource[s] = { fieldProvenance: (rows.hardware[s]!.fieldProvenance ?? null) as never };
  }

  // Per-field verification maps.
  function fieldVerificationMap(
    fields: readonly string[],
    merged: unknown,
    bySource: Partial<Record<ProfileSource, { fieldProvenance: FieldProvenanceMap | null }>>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      out[f] = ProfileInheritance.effectiveFieldVerification(
        f as never,
        merged as never,
        bySource,
      );
    }
    return out;
  }

  // Verification-gap resolution.
  const contributingRaw: Array<{ verificationGaps: string[] | null }> = [];
  for (const s of scopes) {
    for (const kind of ["construction", "material", "hardware"] as const) {
      const r = rows[kind][s];
      if (r) contributingRaw.push({ verificationGaps: (r.verificationGaps as string[] | null) ?? null });
    }
  }
  const gaps = ProfileInheritance.effectiveVerificationGaps({
    merged: { construction: cMerged as never, material: mMerged as never, hardware: hMerged as never },
    contributingRaw,
    profilesBySource: { construction: cBySource, material: mBySource, hardware: hBySource },
    purpose: "shop_profile_completeness",
  });

  // Deferred capabilities.
  const contributions: ProfileInheritance.DeferredCapabilityContribution[] = [];
  for (const s of scopes) {
    for (const kind of ["construction", "material", "hardware"] as const) {
      const r = rows[kind][s];
      if (!r) continue;
      contributions.push({ scope: s, kind, metadata: (r.metadata as Record<string, unknown> | null) ?? null });
    }
  }
  const deferred = ProfileInheritance.effectiveDeferredCapabilities({ contributions });

  // Readiness codes (non-blocking warnings only).
  const readiness: EffectiveProfilePayload["readiness"] = [];

  // PROFILE_UNVERIFIED_* — group by category. Emit one code per gap key.
  for (const gap of gaps.open) {
    const code = classifyReadinessCodeForGap(gap);
    readiness.push({
      code,
      severity: "warning",
      scope: "organization", // Origin varies; report at org level for now.
      detail: gap,
    });
  }
  // PROFILE_CAPABILITY_DEFERRED — one code per contribution.
  for (const d of deferred) {
    readiness.push({
      code: "PROFILE_CAPABILITY_DEFERRED",
      severity: "warning",
      scope: d.scope,
      kind: d.kind,
      detail: d.capability.capability,
      sourceRef: d.capability.sourceRef,
    });
  }

  return {
    construction: {
      effective:    cMerged.effective as never,
      fieldSources: cMerged.fieldSources as never,
      profileIds:   cMerged.profileIds,
      fieldVerification: fieldVerificationMap(CONSTRUCTION_FIELDS, cMerged, cBySource),
    },
    material: {
      effective:    mMerged.effective as never,
      fieldSources: mMerged.fieldSources as never,
      profileIds:   mMerged.profileIds,
      fieldVerification: fieldVerificationMap(MATERIAL_FIELDS, mMerged, mBySource),
    },
    hardware: {
      effective:    hMerged.effective as never,
      fieldSources: hMerged.fieldSources as never,
      profileIds:   hMerged.profileIds,
      fieldVerification: fieldVerificationMap(HARDWARE_FIELDS, hMerged, hBySource),
    },
    gaps,
    deferredCapabilities: deferred,
    readiness,
  };
}

/** Maps a canonical gap key to its PROFILE_UNVERIFIED_* readiness code
 *  bucket. Groups gaps by manufacturing concern so the UI can render
 *  concise categorized warnings. */
function classifyReadinessCodeForGap(gap: string): string {
  if (gap === "back_thickness" || gap === "back_attachment_method" || gap === "back_material") {
    return "PROFILE_UNVERIFIED_BACK_RULE";
  }
  if (gap.startsWith("face_frame_")) {
    return "PROFILE_UNVERIFIED_FACE_FRAME_DIMENSIONS";
  }
  if (
    gap.startsWith("hinge_") || gap.startsWith("drawer_slide_") ||
    gap === "drawer_box_clearance"
  ) {
    return "PROFILE_UNVERIFIED_HARDWARE_SETBACK";
  }
  if (gap === "boring_system" || gap === "shelf_pin_spacing" || gap === "tool_assignment") {
    return "PROFILE_UNVERIFIED_BORING_RULES";
  }
  return "PROFILE_UNVERIFIED_CNC_RULES";
}
