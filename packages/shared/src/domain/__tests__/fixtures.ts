import type { Cabinet, CabinetPart } from "../../types/cabinet";
import type {
  CabinetDesign,
  CabinetDesignDocumentV1,
  PartDesign,
  ProfileRef,
  RoomDesign,
} from "../design-document";
import { CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION } from "../design-document";
import type { HardwareProfile } from "../profiles/hardware";
import type { MaterialProfile } from "../profiles/material";
import {
  createLegacyCadProfile,
  createLegacyFaceFrameProfile,
  createLegacyVisualProfile,
} from "../profiles/construction";

// Fixture cabinets used across the domain test suites. They cover the eight
// canonical scenarios called out in the STEP 2 spec:
//
//   1. frameless base cabinet
//   2. frameless 3-drawer base
//   3. face-frame base
//   4. sink base
//   5. tall cabinet
//   6. cabinet with adjustable shelves
//   7. cabinet with manual/custom part
//   8. generated cabinet with one overridden part

const iso = "2026-08-24T00:00:00.000Z";

function legacyPart(overrides: Partial<CabinetPart> & { id: string; partType: CabinetPart["partType"] }): CabinetPart {
  return {
    id: overrides.id,
    cabinetId: overrides.cabinetId ?? "cab_1",
    orgId: overrides.orgId ?? "org_1",
    name: overrides.name ?? overrides.partType,
    partType: overrides.partType,
    width: overrides.width ?? 600,
    height: overrides.height ?? 720,
    thickness: overrides.thickness ?? 18,
    quantity: overrides.quantity ?? 1,
    materialId: overrides.materialId ?? null,
    grainDir: overrides.grainDir ?? null,
    edgeBanding: overrides.edgeBanding ?? null,
    cutParams: overrides.cutParams ?? null,
    assemblyGroup: overrides.assemblyGroup ?? "carcass",
    isManual: overrides.isManual ?? false,
    createdAt: overrides.createdAt ?? iso,
    updatedAt: overrides.updatedAt ?? iso,
  };
}

function legacyCabinet(overrides: Partial<Cabinet> & { id: string }): Cabinet {
  return {
    id: overrides.id,
    roomId: overrides.roomId ?? "room_1",
    orgId: overrides.orgId ?? "org_1",
    type: overrides.type ?? "base",
    name: overrides.name ?? "Cabinet",
    width: overrides.width ?? 600,
    height: overrides.height ?? 870,
    depth: overrides.depth ?? 580,
    posX: overrides.posX ?? 0,
    posY: overrides.posY ?? 0,
    posZ: overrides.posZ ?? 0,
    parameters: overrides.parameters ?? {},
    materialId: overrides.materialId ?? null,
    parts: overrides.parts ?? [],
    createdAt: overrides.createdAt ?? iso,
    updatedAt: overrides.updatedAt ?? iso,
  };
}

// ── Legacy cabinet fixtures (source data for adapter tests) ──────────────────

export const legacyFramelessBase = legacyCabinet({
  id: "cab_frameless_base",
  type: "base",
  name: "Frameless Base 600",
  width: 600,
  height: 870,
  depth: 580,
  parameters: {
    role: "cabinet",
    doorCount: 1,
    finishStyle: "gloss-white",
    // Unknown legacy fields — must be preserved by the adapter.
    hingeType: "blum-clip-top",
    ecabsExportedAt: iso,
  },
  parts: [
    legacyPart({ id: "p1", partType: "left_panel", width: 580, height: 720, thickness: 18 }),
    legacyPart({ id: "p2", partType: "right_panel", width: 580, height: 720, thickness: 18 }),
    legacyPart({ id: "p3", partType: "bottom_panel", width: 564, height: 580, thickness: 18 }),
    legacyPart({ id: "p4", partType: "door", width: 596, height: 720, thickness: 18 }),
  ],
});

export const legacyFramelessThreeDrawerBase = legacyCabinet({
  id: "cab_frameless_3drawer",
  type: "drawer_base",
  name: "Frameless 3-Drawer Base 600",
  width: 600,
  parameters: {
    role: "cabinet",
    drawerCount: 3,
  },
  parts: [
    legacyPart({ id: "d_left", partType: "left_panel" }),
    legacyPart({ id: "d_right", partType: "right_panel" }),
    legacyPart({ id: "d_1", partType: "drawer_front", height: 180 }),
    legacyPart({ id: "d_2", partType: "drawer_front", height: 180 }),
    legacyPart({ id: "d_3", partType: "drawer_front", height: 180 }),
  ],
});

export const legacyFaceFrameBase = legacyCabinet({
  id: "cab_faceframe_base",
  type: "base",
  name: "Face-Frame Base 900",
  width: 900,
  parameters: {
    role: "cabinet",
    doorCount: 2,
    constructionMethod: "face_frame",
    stileWidth: 38,
    railWidth: 38,
    faceFrameThickness: 19,
  },
  parts: [
    legacyPart({ id: "ff_stile_l", partType: "face_frame_stile" }),
    legacyPart({ id: "ff_stile_r", partType: "face_frame_stile" }),
    legacyPart({ id: "ff_rail_t", partType: "face_frame_rail" }),
    legacyPart({ id: "ff_rail_b", partType: "face_frame_rail" }),
    legacyPart({ id: "door_l", partType: "door" }),
    legacyPart({ id: "door_r", partType: "door" }),
  ],
});

export const legacySinkBase = legacyCabinet({
  id: "cab_sink_base",
  type: "sink_base",
  name: "Sink Base 900",
  width: 900,
  parameters: {
    role: "cabinet",
    doorCount: 2,
    plumbingClearance: 100,
    hasFalseFront: true,
  },
  parts: [
    legacyPart({ id: "sb_left", partType: "left_panel" }),
    legacyPart({ id: "sb_right", partType: "right_panel" }),
    legacyPart({ id: "sb_ff", partType: "drawer_front", isManual: false }),
    legacyPart({ id: "sb_door_l", partType: "door" }),
    legacyPart({ id: "sb_door_r", partType: "door" }),
  ],
});

export const legacyTallCabinet = legacyCabinet({
  id: "cab_tall",
  type: "tall",
  name: "Tall Pantry 600",
  width: 600,
  height: 2400,
  depth: 580,
  parameters: {
    role: "cabinet",
    doorCount: 2,
    shelfCount: 5,
  },
  parts: [
    legacyPart({ id: "t_left", partType: "left_panel", height: 2340 }),
    legacyPart({ id: "t_right", partType: "right_panel", height: 2340 }),
    legacyPart({ id: "t_shelf_1", partType: "shelf" }),
    legacyPart({ id: "t_shelf_2", partType: "shelf" }),
    legacyPart({ id: "t_shelf_3", partType: "shelf" }),
    legacyPart({ id: "t_shelf_4", partType: "shelf" }),
    legacyPart({ id: "t_shelf_5", partType: "shelf" }),
  ],
});

export const legacyAdjustableShelfCabinet = legacyCabinet({
  id: "cab_adj_shelves",
  type: "wall",
  name: "Wall Cabinet 900 (Adjustable Shelves)",
  width: 900,
  height: 720,
  depth: 320,
  parameters: {
    role: "cabinet",
    doorCount: 2,
    shelfCount: 2,
    adjustableShelves: true,
    shelfPinSpacingMm: 32,
  },
  parts: [
    legacyPart({ id: "w_left", partType: "left_panel" }),
    legacyPart({ id: "w_right", partType: "right_panel" }),
    legacyPart({ id: "w_shelf_1", partType: "shelf" }),
    legacyPart({ id: "w_shelf_2", partType: "shelf" }),
    legacyPart({ id: "w_door_l", partType: "door" }),
    legacyPart({ id: "w_door_r", partType: "door" }),
  ],
});

export const legacyCabinetWithManualPart = legacyCabinet({
  id: "cab_with_manual",
  type: "base",
  name: "Base with Custom Filler Panel",
  parts: [
    legacyPart({ id: "m_left", partType: "left_panel" }),
    legacyPart({ id: "m_right", partType: "right_panel" }),
    // Manual/custom part — must survive recomputation.
    legacyPart({
      id: "m_custom",
      partType: "custom",
      name: "Custom Filler Panel",
      width: 25,
      height: 720,
      thickness: 18,
      isManual: true,
      cutParams: { note: "Trimmed on-site" },
    }),
  ],
});

/**
 * A cabinet whose parts are all generated EXCEPT one, which has been
 * intentionally overridden by the designer (`generated_override`). Used to
 * verify the four-state PartGenerationMode.
 */
export const legacyCabinetWithGeneratedOverride = legacyCabinet({
  id: "cab_gen_override",
  type: "base",
  parts: [
    legacyPart({ id: "go_left", partType: "left_panel" }),
    legacyPart({ id: "go_right", partType: "right_panel" }),
    legacyPart({ id: "go_shelf", partType: "shelf", height: 22 }),
    legacyPart({ id: "go_door", partType: "door" }),
  ],
});

export const ALL_LEGACY_CABINETS: readonly Cabinet[] = [
  legacyFramelessBase,
  legacyFramelessThreeDrawerBase,
  legacyFaceFrameBase,
  legacySinkBase,
  legacyTallCabinet,
  legacyAdjustableShelfCabinet,
  legacyCabinetWithManualPart,
  legacyCabinetWithGeneratedOverride,
];

// ── V2 fixtures ──────────────────────────────────────────────────────────────

export function makeDemoMaterialProfile(
  id: string = "mat_white_oak",
  version: number = 1,
): MaterialProfile {
  return {
    id,
    version,
    name: "White Oak Plywood 18 mm",
    materialType: "plywood",
    thicknessMm: 18,
    grainDirection: "vertical",
    edgeBanding: {
      top: true,
      bottom: false,
      left: true,
      right: true,
      material: "white-oak-veneer",
      thicknessMm: 0.4,
    },
    finish: { kind: "lacquer", sheen: "satin", color: "clear" },
    color: "#c8a87a",
  };
}

export function makeDemoHardwareProfile(
  id: string = "hw_blum",
  version: number = 1,
): HardwareProfile {
  return {
    id,
    version,
    name: "Blum Standard",
    hinge: {
      type: "blum-clip-top-blumotion",
      boring: { cupDiameterMm: 35, cupDepthMm: 12.5, cupInsetMm: 5 },
      requiredClearanceMm: 3,
    },
    drawerSlide: {
      type: "blum-tandem-plus-blumotion",
      sideClearanceMm: 13,
      bottomClearanceMm: 5,
      lengthIncrementMm: 50,
    },
    shelfPin: { type: "5mm-metal-pin", diameterMm: 5, minEdgeDistanceMm: 32 },
  };
}

export const demoConstructionRef: ProfileRef = { id: "legacy-visual", version: 1 };
export const demoConstructionRefV2: ProfileRef = { id: "legacy-cad", version: 1 };
export const demoConstructionRefFaceFrame: ProfileRef = {
  id: "legacy-face-frame",
  version: 1,
};
export const demoMaterialRef: ProfileRef = { id: "mat_white_oak", version: 1 };
export const demoHardwareRef: ProfileRef = { id: "hw_blum", version: 1 };

export function makeDemoProfileRegistry(): {
  construction: (ref: ProfileRef) => import("../profiles/construction").ConstructionProfile | undefined;
  material: (ref: ProfileRef) => MaterialProfile | undefined;
  hardware: (ref: ProfileRef) => HardwareProfile | undefined;
} {
  const constructionCatalog = new Map([
    ["legacy-visual", createLegacyVisualProfile()],
    ["legacy-cad", createLegacyCadProfile()],
    ["legacy-face-frame", createLegacyFaceFrameProfile()],
  ]);
  const materialCatalog = new Map([["mat_white_oak", makeDemoMaterialProfile()]]);
  const hardwareCatalog = new Map([["hw_blum", makeDemoHardwareProfile()]]);
  return {
    construction: (ref) => constructionCatalog.get(ref.id),
    material: (ref) => materialCatalog.get(ref.id),
    hardware: (ref) => hardwareCatalog.get(ref.id),
  };
}

function demoPart(part: Partial<PartDesign> & { id: string; partType: PartDesign["partType"] }): PartDesign {
  return {
    id: part.id,
    name: part.name ?? part.partType,
    partType: part.partType,
    generationMode: part.generationMode ?? "generated",
    quantity: part.quantity ?? 1,
    dimensions: part.dimensions ?? { widthMm: 600, heightMm: 720, thicknessMm: 18 },
    materialProfileRef: part.materialProfileRef,
    overrides: part.overrides,
    legacyCutParams: part.legacyCutParams,
    legacyMetadata: part.legacyMetadata,
  };
}

export function makeDemoCabinet(): CabinetDesign {
  return {
    id: "cab_demo_1",
    type: "base",
    name: "Demo Base 600",
    position: { x: 0, y: 0, z: 0 },
    dimensions: { widthMm: 600, heightMm: 870, depthMm: 580 },
    constructionProfileRef: demoConstructionRef,
    materialProfileRef: demoMaterialRef,
    hardwareProfileRef: demoHardwareRef,
    parameters: { role: "cabinet", doorCount: 1 },
    parts: [
      demoPart({ id: "dp_left", partType: "left_panel" }),
      demoPart({ id: "dp_right", partType: "right_panel" }),
      demoPart({
        id: "dp_custom",
        partType: "custom",
        name: "Site-Trimmed Filler",
        generationMode: "manual",
        dimensions: { widthMm: 25, heightMm: 720, thicknessMm: 18 },
      }),
      demoPart({
        id: "dp_override_shelf",
        partType: "shelf",
        generationMode: "generated_override",
        dimensions: { widthMm: 560, heightMm: 22, thicknessMm: 18 },
      }),
    ],
  };
}

export function makeDemoRoom(): RoomDesign {
  return {
    id: "room_demo",
    name: "Demo Kitchen",
    dimensions: { widthMm: 4000, heightMm: 2700, depthMm: 3000 },
    cabinets: [makeDemoCabinet()],
  };
}

export function makeDemoDocument(): CabinetDesignDocumentV1 {
  return {
    schemaVersion: CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION,
    organizationId: "org_1",
    projectId: "proj_1",
    units: "mm",
    revision: 1,
    projectDefaults: {
      constructionProfileRef: demoConstructionRef,
      materialProfileRef: demoMaterialRef,
      hardwareProfileRef: demoHardwareRef,
    },
    rooms: [makeDemoRoom()],
    constructionProfiles: [demoConstructionRef],
    materialProfiles: [demoMaterialRef],
    hardwareProfiles: [demoHardwareRef],
  };
}
