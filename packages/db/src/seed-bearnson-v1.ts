// Bearnson Production V1 profile seed.
//
// Creates (or updates) three org-scoped profile rows for the org
// identified by BEARNSON_ORG_ID (env var) and points the org's default
// profile IDs at them.
//
// Safe to run repeatedly:
//   · Rows are matched by (orgId, name).
//   · Existing rows have their approved-fact fields overwritten with the
//     verified values from this seed.
//   · Fields not owned by this seed (e.g. metadata added by admins)
//     are preserved for existing rows via a targeted update.
//
// Usage:
//   BEARNSON_ORG_ID=<org_id> DATABASE_URL="mysql://…" \
//     npx ts-node packages/db/src/seed-bearnson-v1.ts

import { prisma } from "./client";

const APPROVED_PROPOSAL =
  "Approved Proposal.pdf (Bearnson Woodworks 2026-05-20)";
const BUILD_SHEETS =
  "Klint Anderson Build Sheets 09/04/26; Hawkes Kitchen Build Sheets 03/27/26; Hawkes Laundry Build Sheets";

const CONSTRUCTION_GAPS: string[] = [
  "back_attachment_method",
  "toe_kick_construction",
  "toe_kick_height",
  "face_frame_stile_width",
  "face_frame_rail_width",
  "face_frame_thickness",
  "shelf_thickness",
  "shelf_pin_spacing",
  "fixed_vs_adjustable_shelf_rule",
  "dado_dimensions",
  "rabbet_dimensions",
  "joinery_family",
  "confirmat_screw_dowel_rule",
  "edge_banding_rule",
  "scribe_allowance",
  "reveal_gap_standard",
  "door_overlay_clearance",
  "crown_construction_detail",
  "appliance_panel_fastening",
];

const MATERIAL_GAPS: string[] = [
  "face_frame_material",
  "door_material",
  "shelf_material",
  "edge_banding_rule",
  "drawer_box_material",
];

const HARDWARE_GAPS: string[] = [
  "hinge_system_family",
  "hinge_cup_setback",
  "hinge_plate_setback",
  "hinge_boring_pattern",
  "drawer_slide_system_family",
  "drawer_slide_length",
  "drawer_slide_setback",
  "drawer_box_clearance",
  "boring_system",
  "tool_assignment",
];

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

  // ─── ConstructionProfile "Bearnson Production V1" ────────────────────
  const constructionValues = {
    name: "Bearnson Production V1",
    description:
      "Shop-standard construction defaults verified from Bearnson's approved-proposal boilerplate + Klint/Hawkes build sheets.",
    constructionMethod: null,
    frontOverlayMode: null,
    carcassThicknessMm: 19.05,
    drawerBoxThicknessMm: null,
    drawerBoxJoinery: null,
    backThicknessMm: 6.35,
    adjustableShelfThicknessMm: 19.05,
    nailerThicknessMm: 19.05,
    verificationStatus: "partially_verified",
    verificationGaps: CONSTRUCTION_GAPS,
    sourceRef: BUILD_SHEETS,
    fieldProvenance: {
      carcassThicknessMm:         { status: "verified", sourceRef: BUILD_SHEETS },
      backThicknessMm:            { status: "verified", sourceRef: BUILD_SHEETS },
      adjustableShelfThicknessMm: { status: "verified", sourceRef: BUILD_SHEETS },
      nailerThicknessMm:          { status: "verified", sourceRef: BUILD_SHEETS },
    },
  };

  const existingC = await prisma.constructionProfile.findFirst({
    where: { orgId, name: constructionValues.name },
    select: { id: true },
  });
  const construction = existingC
    ? await prisma.constructionProfile.update({ where: { id: existingC.id }, data: constructionValues })
    : await prisma.constructionProfile.create({ data: { ...constructionValues, orgId } });
  console.log(`ConstructionProfile: ${construction.id} (${existingC ? "updated" : "created"})`);

  // ─── CabinetMaterialProfile "Bearnson Production V1" ─────────────────
  const materialValues = {
    name: "Bearnson Production V1",
    description:
      "Shop-standard material defaults verified from Bearnson build sheets.",
    carcassMaterialSpec:         "Maple Melamine",
    drawerBoxMaterialSpec:       null,
    faceFrameMaterialSpec:       null,
    doorMaterialSpec:            null,
    shelfMaterialSpec:           null,
    backMaterialSpec:            "Maple Melamine G2S",
    adjustableShelfMaterialSpec: "Maple Melamine",
    nailerMaterialSpec:          "Maple Melamine",
    verificationStatus: "partially_verified",
    verificationGaps: MATERIAL_GAPS,
    sourceRef: BUILD_SHEETS,
    fieldProvenance: {
      carcassMaterialSpec:         { status: "verified", sourceRef: BUILD_SHEETS },
      backMaterialSpec:            { status: "verified", sourceRef: BUILD_SHEETS },
      adjustableShelfMaterialSpec: { status: "verified", sourceRef: BUILD_SHEETS },
      nailerMaterialSpec:          { status: "verified", sourceRef: BUILD_SHEETS },
    },
  };
  const existingM = await prisma.cabinetMaterialProfile.findFirst({
    where: { orgId, name: materialValues.name },
    select: { id: true },
  });
  const material = existingM
    ? await prisma.cabinetMaterialProfile.update({ where: { id: existingM.id }, data: materialValues })
    : await prisma.cabinetMaterialProfile.create({ data: { ...materialValues, orgId } });
  console.log(`CabinetMaterialProfile: ${material.id} (${existingM ? "updated" : "created"})`);

  // ─── HardwareProfile "Bearnson Production V1" ────────────────────────
  const hardwareValues = {
    name: "Bearnson Production V1",
    description:
      "Shop-standard hardware defaults verified from Bearnson's approved-proposal boilerplate.",
    hingeManufacturer:       "Blum",
    hingeSoftClose:          true,
    hingeSystem:             null,
    drawerSlideManufacturer: "Blum",
    drawerSlideSoftClose:    true,
    drawerSlideSystem:       null,
    verificationStatus: "partially_verified",
    verificationGaps: HARDWARE_GAPS,
    sourceRef: APPROVED_PROPOSAL,
    fieldProvenance: {
      hingeManufacturer:       { status: "verified", sourceRef: APPROVED_PROPOSAL },
      hingeSoftClose:          { status: "verified", sourceRef: APPROVED_PROPOSAL },
      drawerSlideManufacturer: { status: "verified", sourceRef: APPROVED_PROPOSAL },
      drawerSlideSoftClose:    { status: "verified", sourceRef: APPROVED_PROPOSAL },
    },
  };
  const existingH = await prisma.hardwareProfile.findFirst({
    where: { orgId, name: hardwareValues.name },
    select: { id: true },
  });
  const hardware = existingH
    ? await prisma.hardwareProfile.update({ where: { id: existingH.id }, data: hardwareValues })
    : await prisma.hardwareProfile.create({ data: { ...hardwareValues, orgId } });
  console.log(`HardwareProfile: ${hardware.id} (${existingH ? "updated" : "created"})`);

  // ─── Point org defaults at the seeded profiles ───────────────────────
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      defaultConstructionProfileId: construction.id,
      defaultMaterialProfileId:     material.id,
      defaultHardwareProfileId:     hardware.id,
    },
  });
  console.log(`Organization ${orgId} → Bearnson Production V1 assigned as defaults.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
