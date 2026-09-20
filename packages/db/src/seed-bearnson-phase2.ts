// Bearnson Phase 2 seed.
//
// Creates (or updates) the Phase 2 cabinet family rules, front systems,
// drawer systems for the org identified by BEARNSON_ORG_ID.
// Assignments live in Organization.metadata.cabinetSystemAssignments —
// merged into the existing metadata bag, NEVER replacing sibling keys.
//
// Idempotent — matches rows by (orgId, name). Metadata merge on the
// Organization row preserves any pre-existing metadata content.
//
// Manufacturing boundary unchanged: no compileUnit / CAD / BOM changes.
//
// Usage:
//   BEARNSON_ORG_ID=<org_id> DATABASE_URL="mysql://…" \
//     npx ts-node packages/db/src/seed-bearnson-phase2.ts

import { Prisma } from "@prisma/client";
import { prisma } from "./client";

const CLIENT_BUILD_SHEETS_KLINT   = "Klint Anderson Build Sheets 09/04/26";
const CLIENT_BUILD_SHEETS_HAWKES  = "Hawkes Kitchen Build Sheets 03/27/26";
const CLIENT_SHOP_PACKET_HAWKES   = "Hawkes Kitchen Shop Packet";

async function main() {
  const orgId = process.env.BEARNSON_ORG_ID;
  if (!orgId) {
    console.error("BEARNSON_ORG_ID env var is required.");
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    console.error(`Organization ${orgId} not found.`);
    process.exit(1);
  }

  // ─── Bearnson Standard Base V1 ────────────────────────────────────────
  const baseValues = {
    cabinetType: "base",
    name: "Bearnson Standard Base V1",
    description:
      "Bearnson shop-standard base geometry — Klint Anderson Build Sheets. " +
      "Non-standard base-family assemblies must be left unassigned or opt out " +
      "via Cabinet.parameters.disableFamilyRule = true.",
    hasToeKick: true,
    hasBack:    true,
    hasNailer:  true,
    fixedShelfPolicy: null,
    cornerVariant:    null,
    toeHeightMm:    101.6,
    toeRecessMm:    63.5,
    topRevealMm:    6.35,
    bottomRevealMm: 0,
    topScribeMm:    0,
    bottomScribeMm: 0,
    verificationStatus: "verified",
    verificationGaps: ["fixedShelfPolicy"],
    sourceRef: `${CLIENT_BUILD_SHEETS_KLINT} — Assembly #11 (and additional standard-base assemblies in the same packet)`,
    fieldProvenance: {
      toeHeightMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      toeRecessMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      topRevealMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      bottomRevealMm:   { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      topScribeMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      bottomScribeMm:   { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasToeKick:       { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasBack:          { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasNailer:        { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
    },
    metadata: {
      scopeNote:
        "Applies to Bearnson standard base assemblies. Special/non-standard " +
        "base-family assemblies must not inherit this rule — set " +
        "Cabinet.parameters.disableFamilyRule = true on those cabinets, " +
        "or assign a different family rule at the room/project/cabinet scope.",
    },
  };
  const base = await upsertFamilyRule(orgId, baseValues);
  console.log(`CabinetFamilyRule: ${base.id} (${base.action}) — ${baseValues.name}`);

  // ─── Bearnson Standard Upper V1 ───────────────────────────────────────
  const wallValues = {
    cabinetType: "wall",
    name: "Bearnson Standard Upper V1",
    description:
      "Bearnson shop-standard upper geometry — Klint Anderson Build Sheets " +
      "Std Upper assemblies. Non-standard upper assemblies must be left " +
      "unassigned or opt out via Cabinet.parameters.disableFamilyRule = true.",
    hasToeKick: false,
    hasBack:    true,
    hasNailer:  true,
    fixedShelfPolicy: null,
    cornerVariant:    null,
    toeHeightMm:    0,
    toeRecessMm:    63.5,
    topRevealMm:    44.45,
    bottomRevealMm: 0,
    topScribeMm:    38.1,
    bottomScribeMm: 0,
    verificationStatus: "verified",
    verificationGaps: ["fixedShelfPolicy"],
    sourceRef: `${CLIENT_BUILD_SHEETS_KLINT} — Assembly #17 Std Upper (and additional Std Upper assemblies in the same packet)`,
    fieldProvenance: {
      toeHeightMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      toeRecessMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      topRevealMm:      { status: "verified", sourceRef: `${CLIENT_BUILD_SHEETS_KLINT} — repeated Std Upper assemblies` },
      bottomRevealMm:   { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      topScribeMm:      { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      bottomScribeMm:   { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasToeKick:       { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasBack:          { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      hasNailer:        { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
    },
    metadata: {
      scopeNote:
        "Applies to Bearnson STANDARD UPPER assemblies. Special/non-standard " +
        "upper assemblies (unusual heights, glass, appliance-adjacent) must " +
        "not inherit this rule — set Cabinet.parameters.disableFamilyRule = true.",
    },
  };
  const wall = await upsertFamilyRule(orgId, wallValues);
  console.log(`CabinetFamilyRule: ${wall.id} (${wall.action}) — ${wallValues.name}`);

  // ─── Bearnson Hinged Single ───────────────────────────────────────────
  const hingedSingle = await upsertFrontSystem(orgId, {
    name: "Bearnson Hinged Single",
    description: "Single hinged door front (library entry — no overlay semantics; frontOverlayMode lives in ConstructionProfile).",
    kind: "hinged_single",
    role: "cabinet_front",
    glassFlag: false,
    verificationStatus: "verified",
    verificationGaps: null,
    sourceRef: CLIENT_BUILD_SHEETS_KLINT,
    fieldProvenance: {
      kind: { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      role: { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
    },
    metadata: null,
  });
  console.log(`FrontSystem: ${hingedSingle.id} (${hingedSingle.action}) — Bearnson Hinged Single`);

  // ─── Bearnson Hinged Double ───────────────────────────────────────────
  const hingedDouble = await upsertFrontSystem(orgId, {
    name: "Bearnson Hinged Double",
    description: "Double hinged door front (library entry).",
    kind: "hinged_double",
    role: "cabinet_front",
    glassFlag: false,
    verificationStatus: "verified",
    verificationGaps: null,
    sourceRef: CLIENT_BUILD_SHEETS_KLINT,
    fieldProvenance: {
      kind: { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
      role: { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
    },
    metadata: null,
  });
  console.log(`FrontSystem: ${hingedDouble.id} (${hingedDouble.action}) — Bearnson Hinged Double`);

  // ─── Bearnson Traditional Drawer V1 (split provenance) ────────────────
  const traditionalDrawer = await upsertDrawerSystem(orgId, {
    name: "Bearnson Traditional Drawer V1",
    description: "Bearnson traditional dovetail drawer construction.",
    kind: "traditional",
    boxSideThicknessMm:     15.875,   // 5/8"
    boxBottomThicknessMm:   6.35,     // 1/4"
    boxBackThicknessMm:     15.875,
    boxSubFrontThicknessMm: 15.875,
    boxJoinery: "dovetail",
    proprietaryFamily: null,
    verificationStatus: "verified",
    verificationGaps: null,
    sourceRef: `${CLIENT_BUILD_SHEETS_HAWKES} (dimensions) + ${CLIENT_SHOP_PACKET_HAWKES} (joinery)`,
    fieldProvenance: {
      boxSideThicknessMm:     { status: "verified", sourceRef: `${CLIENT_BUILD_SHEETS_HAWKES} — Assembly #241 (5/8 Baltic Birch Ply)` },
      boxBottomThicknessMm:   { status: "verified", sourceRef: `${CLIENT_BUILD_SHEETS_HAWKES} — Assembly #241 (1/4 Baltic Birch)` },
      boxBackThicknessMm:     { status: "verified", sourceRef: `${CLIENT_BUILD_SHEETS_HAWKES} — Assembly #241 (5/8 Baltic Birch Ply)` },
      boxSubFrontThicknessMm: { status: "verified", sourceRef: `${CLIENT_BUILD_SHEETS_HAWKES} — Assembly #241 (5/8 Baltic Birch Ply)` },
      boxJoinery:             { status: "verified", sourceRef: `${CLIENT_SHOP_PACKET_HAWKES} — Drawer Box Construction = Dovetail` },
    },
    metadata: {
      provenanceNote:
        "Do NOT source dovetail joinery from the Build Sheet 'Bearnson Standards DOWEL' " +
        "line — that refers to broader cabinet construction, not drawer-box joinery.",
    },
  });
  console.log(`DrawerSystem: ${traditionalDrawer.id} (${traditionalDrawer.action}) — Bearnson Traditional Drawer V1`);

  // ─── Bearnson Blum Legrabox ───────────────────────────────────────────
  const legrabox = await upsertDrawerSystem(orgId, {
    name: "Bearnson Blum Legrabox",
    description: "Blum Legrabox proprietary drawer system (library entry).",
    kind: "proprietary",
    boxSideThicknessMm:     null,
    boxBottomThicknessMm:   null,
    boxBackThicknessMm:     null,
    boxSubFrontThicknessMm: null,
    boxJoinery:             null,
    proprietaryFamily: "Blum Legrabox",
    verificationStatus: "verified",
    verificationGaps: null,
    sourceRef: `${CLIENT_BUILD_SHEETS_KLINT} — Legrabox drawer-side / front bracket / back bracket / guide lines`,
    fieldProvenance: {
      proprietaryFamily: { status: "verified", sourceRef: CLIENT_BUILD_SHEETS_KLINT },
    },
    metadata: {
      provenanceNote:
        "Individual sheets show 550-height variants but Phase 2 does not encode " +
        "height/length/load/setback/boring/SKU selection. Those remain deferred " +
        "until enough evidence supports universal selection rules.",
    },
  });
  console.log(`DrawerSystem: ${legrabox.id} (${legrabox.action}) — Bearnson Blum Legrabox`);

  // ─── Organization assignment — MERGE, don't overwrite ─────────────────
  // Only base + wall family rules assigned at org scope. No preferred
  // front or drawer defaults — per v3 correction #5/6/15.
  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { metadata: true },
  });
  const existingMetadata = (orgRow?.metadata as Record<string, unknown> | null) ?? {};
  const existingCsa = (existingMetadata.cabinetSystemAssignments as Record<string, unknown> | null) ?? {};
  const existingFamilyMap = (existingCsa.familyRuleIdsByCabinetType as Record<string, string> | null) ?? {};

  const nextCsa: Record<string, unknown> = {
    ...existingCsa,
    familyRuleIdsByCabinetType: {
      ...existingFamilyMap,
      base: base.id,
      wall: wall.id,
    },
    // Do NOT set preferredFrontSystemId or preferredDrawerSystemId here.
    // Preserve any existing values if present (from a prior run or admin edit).
  };

  const nextMetadata = { ...existingMetadata, cabinetSystemAssignments: nextCsa };

  await prisma.organization.update({
    where: { id: orgId },
    data: { metadata: nextMetadata as never },
  });
  console.log(
    `Organization ${orgId} → cabinetSystemAssignments.familyRuleIdsByCabinetType.{base,wall} assigned. ` +
      `preferredFrontSystemId / preferredDrawerSystemId unchanged (deliberately null).`,
  );
}

// ─── Upsert helpers ─────────────────────────────────────────────────────

async function upsertFamilyRule(
  orgId: string,
  values: {
    cabinetType: string;
    name: string;
    description: string;
    hasToeKick: boolean;
    hasBack: boolean;
    hasNailer: boolean;
    fixedShelfPolicy: string | null;
    cornerVariant: string | null;
    toeHeightMm: number;
    toeRecessMm: number;
    topRevealMm: number;
    bottomRevealMm: number;
    topScribeMm: number;
    bottomScribeMm: number;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string;
    fieldProvenance: Record<string, unknown>;
    metadata: Record<string, unknown>;
  },
): Promise<{ id: string; action: "created" | "updated" }> {
  const existing = await prisma.cabinetFamilyRule.findFirst({
    where: { orgId, name: values.name },
    select: { id: true },
  });
  if (existing) {
    const updated = await prisma.cabinetFamilyRule.update({
      where: { id: existing.id },
      data: {
        ...values,
        verificationGaps: values.verificationGaps === null ? Prisma.DbNull : values.verificationGaps,
      } as never,
    });
    return { id: updated.id, action: "updated" };
  }
  const created = await prisma.cabinetFamilyRule.create({
    data: {
      ...values,
      orgId,
      verificationGaps: values.verificationGaps === null ? Prisma.DbNull : values.verificationGaps,
    } as never,
  });
  return { id: created.id, action: "created" };
}

async function upsertFrontSystem(
  orgId: string,
  values: {
    name: string;
    description: string;
    kind: string;
    role: string;
    glassFlag: boolean;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string;
    fieldProvenance: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
  },
): Promise<{ id: string; action: "created" | "updated" }> {
  const existing = await prisma.frontSystem.findFirst({
    where: { orgId, name: values.name },
    select: { id: true },
  });
  const data = {
    ...values,
    verificationGaps: values.verificationGaps === null ? Prisma.DbNull : values.verificationGaps,
    metadata: values.metadata === null ? Prisma.DbNull : values.metadata,
  };
  if (existing) {
    const updated = await prisma.frontSystem.update({ where: { id: existing.id }, data: data as never });
    return { id: updated.id, action: "updated" };
  }
  const created = await prisma.frontSystem.create({ data: { ...data, orgId } as never });
  return { id: created.id, action: "created" };
}

async function upsertDrawerSystem(
  orgId: string,
  values: {
    name: string;
    description: string;
    kind: string;
    boxSideThicknessMm: number | null;
    boxBottomThicknessMm: number | null;
    boxBackThicknessMm: number | null;
    boxSubFrontThicknessMm: number | null;
    boxJoinery: string | null;
    proprietaryFamily: string | null;
    verificationStatus: string;
    verificationGaps: string[] | null;
    sourceRef: string;
    fieldProvenance: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
  },
): Promise<{ id: string; action: "created" | "updated" }> {
  const existing = await prisma.drawerSystem.findFirst({
    where: { orgId, name: values.name },
    select: { id: true },
  });
  const data = {
    ...values,
    verificationGaps: values.verificationGaps === null ? Prisma.DbNull : values.verificationGaps,
    metadata: values.metadata === null ? Prisma.DbNull : values.metadata,
  };
  if (existing) {
    const updated = await prisma.drawerSystem.update({ where: { id: existing.id }, data: data as never });
    return { id: updated.id, action: "updated" };
  }
  const created = await prisma.drawerSystem.create({ data: { ...data, orgId } as never });
  return { id: created.id, action: "created" };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
