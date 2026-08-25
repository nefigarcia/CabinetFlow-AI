import { z } from "zod";
import type { CabinetType, PartType } from "../types/cabinet";
import type { PartGenerationMode } from "./parts/generation-mode";

// The CabinetDesignDocumentV1 is the canonical, serializable representation
// of DESIGN INTENT for a WoodCraft OS project. It intentionally does NOT
// contain derived manufacturing geometry (front-panel positions, handle
// coordinates, boring locations, cut lists). Those artifacts are reproducible
// downstream from `(document + resolved profiles + parametric engine)` and
// live in separate cached outputs, not inside the document.
//
// Any adapter/consumer that adds new fields MUST route unknown or legacy
// data through the `legacyMetadata` / `legacyParameters` / `extra` slots so
// production information is never silently discarded.

export const CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION = "1.0" as const;

// ── Primitives ───────────────────────────────────────────────────────────────

export type Units = "mm" | "in";

export interface Vec3Mm {
  x: number;
  y: number;
  z: number;
}

export interface CabinetDimensionsMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export interface RoomDimensionsMm {
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

/**
 * Versioned reference to a profile. The `version` is REQUIRED so that a
 * released manufacturing revision can be exactly reproduced later even if
 * the referenced profile has since evolved.
 */
export interface ProfileRef {
  id: string;
  version: number;
}

export type ConstructionProfileRef = ProfileRef;
export type MaterialProfileRef = ProfileRef;
export type HardwareProfileRef = ProfileRef;

// ── Design defaults (project / room level) ───────────────────────────────────

export interface DesignDefaults {
  constructionProfileRef?: ProfileRef;
  materialProfileRef?: ProfileRef;
  hardwareProfileRef?: ProfileRef;
}

// ── Cabinet-level design ─────────────────────────────────────────────────────

export type CabinetRole = "cabinet" | "opening" | "led_strip" | "open_shelf";

/**
 * DESIGN-INTENT parameters only. This shape must NEVER accumulate derived
 * geometry (door positions, handle coordinates, boring, cut sizes). Those
 * belong in the downstream compiled-geometry artifact.
 *
 * Unknown keys arriving via legacy adapters land in `extra` so information
 * is preserved without polluting the typed surface.
 */
export interface CabinetIntentParameters {
  role?: CabinetRole;
  doorCount?: number;
  drawerCount?: number;
  shelfCount?: number;
  columns?: number;
  rows?: number;
  finishStyle?: string;
  notes?: string;
  extra?: Record<string, unknown>;
}

/**
 * Sparse per-cabinet overrides layered on top of the effective profiles.
 * Kept as `Record<string, unknown>` so that construction/material/hardware
 * profile schemas can evolve independently. The inheritance resolver is
 * responsible for merging + source tracking.
 */
export interface CabinetOverrides {
  construction?: Record<string, unknown>;
  material?: Record<string, unknown>;
  hardware?: Record<string, unknown>;
}

export interface CabinetConstraint {
  id: string;
  code: string;
  metadata?: Record<string, unknown>;
}

// ── Part-level design ────────────────────────────────────────────────────────

export type PartGrainDirection = "horizontal" | "vertical" | "none";

export interface PartEdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface PartDimensionsMm {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
}

export interface PartOverrides {
  dimensions?: Partial<PartDimensionsMm>;
  grainDir?: PartGrainDirection;
  edgeBanding?: Partial<PartEdgeBanding>;
}

export interface PartDesign {
  id: string;
  name: string;
  partType: PartType;
  generationMode: PartGenerationMode;
  quantity: number;

  /**
   * Present for `manual` parts and for legacy parts hydrated from the DB.
   * For pure `generated` parts the dimensions are derived downstream and
   * may be omitted from the intent document.
   */
  dimensions?: PartDimensionsMm;

  materialProfileRef?: ProfileRef;
  overrides?: PartOverrides;

  /** Original `CabinetPart.cutParams` JSON — preserved verbatim. */
  legacyCutParams?: Record<string, unknown>;
  /** Original `CabinetPart.assemblyGroup` + any other unknown fields. */
  legacyMetadata?: Record<string, unknown>;
}

// ── Cabinet ─────────────────────────────────────────────────────────────────-

export interface CabinetDesign {
  id: string;
  type: CabinetType;
  name: string;

  position: Vec3Mm;
  dimensions: CabinetDimensionsMm;

  constructionProfileRef?: ProfileRef;
  materialProfileRef?: ProfileRef;
  hardwareProfileRef?: ProfileRef;

  parameters: CabinetIntentParameters;
  overrides?: CabinetOverrides;

  parts: PartDesign[];
  constraints?: CabinetConstraint[];

  /** Original `Cabinet.parameters` JSON keys unknown to the V2 shape. */
  legacyParameters?: Record<string, unknown>;
}

// ── Room ─────────────────────────────────────────────────────────────────────

export interface RoomDesign {
  id: string;
  name: string;
  dimensions: RoomDimensionsMm;
  defaults?: DesignDefaults;
  cabinets: CabinetDesign[];
  metadata?: Record<string, unknown>;
  legacyMetadata?: Record<string, unknown>;
}

// ── Document ─────────────────────────────────────────────────────────────────

export interface CabinetDesignDocumentV1 {
  schemaVersion: typeof CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION;

  organizationId: string;
  projectId: string;

  units: Units;
  revision: number;

  projectDefaults?: DesignDefaults;

  rooms: RoomDesign[];

  /** Profiles referenced by any node in this document. Versioned by design. */
  constructionProfiles: ConstructionProfileRef[];
  materialProfiles: MaterialProfileRef[];
  hardwareProfiles: HardwareProfileRef[];

  /** Anything from a legacy project record that had no V2 home. */
  legacyMetadata?: Record<string, unknown>;
}

// ── Zod schemas ─────────────────────────────────────────────────────────────-

const cabinetTypeSchema = z.enum([
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
]);

const partTypeSchema = z.enum([
  "left_panel",
  "right_panel",
  "top_panel",
  "bottom_panel",
  "back_panel",
  "shelf",
  "door",
  "drawer_front",
  "drawer_box",
  "toe_kick",
  "mid_rail",
  "filler",
  "face_frame_stile",
  "face_frame_rail",
  "face_frame_mullion",
  "crown_molding",
  "light_rail",
  "custom",
]);

const partGenerationModeSchema = z.enum([
  "generated",
  "generated_override",
  "manual",
  "locked",
]);

const profileRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});

const designDefaultsSchema = z.object({
  constructionProfileRef: profileRefSchema.optional(),
  materialProfileRef: profileRefSchema.optional(),
  hardwareProfileRef: profileRefSchema.optional(),
});

const vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const cabinetDimensionsSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
});

const roomDimensionsSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
});

const partDimensionsSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  thicknessMm: z.number().positive(),
});

const partEdgeBandingSchema = z.object({
  top: z.boolean(),
  bottom: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
});

const partOverridesSchema = z.object({
  dimensions: partDimensionsSchema.partial().optional(),
  grainDir: z.enum(["horizontal", "vertical", "none"]).optional(),
  edgeBanding: partEdgeBandingSchema.partial().optional(),
});

const partDesignSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  partType: partTypeSchema,
  generationMode: partGenerationModeSchema,
  quantity: z.number().int().positive(),
  dimensions: partDimensionsSchema.optional(),
  materialProfileRef: profileRefSchema.optional(),
  overrides: partOverridesSchema.optional(),
  legacyCutParams: z.record(z.unknown()).optional(),
  legacyMetadata: z.record(z.unknown()).optional(),
});

const cabinetIntentParametersSchema = z.object({
  role: z.enum(["cabinet", "opening", "led_strip", "open_shelf"]).optional(),
  doorCount: z.number().int().nonnegative().optional(),
  drawerCount: z.number().int().nonnegative().optional(),
  shelfCount: z.number().int().nonnegative().optional(),
  columns: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  finishStyle: z.string().optional(),
  notes: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
});

const cabinetOverridesSchema = z.object({
  construction: z.record(z.unknown()).optional(),
  material: z.record(z.unknown()).optional(),
  hardware: z.record(z.unknown()).optional(),
});

const cabinetConstraintSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const cabinetDesignSchema = z.object({
  id: z.string().min(1),
  type: cabinetTypeSchema,
  name: z.string(),
  position: vec3Schema,
  dimensions: cabinetDimensionsSchema,
  constructionProfileRef: profileRefSchema.optional(),
  materialProfileRef: profileRefSchema.optional(),
  hardwareProfileRef: profileRefSchema.optional(),
  parameters: cabinetIntentParametersSchema,
  overrides: cabinetOverridesSchema.optional(),
  parts: z.array(partDesignSchema),
  constraints: z.array(cabinetConstraintSchema).optional(),
  legacyParameters: z.record(z.unknown()).optional(),
});

const roomDesignSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  dimensions: roomDimensionsSchema,
  defaults: designDefaultsSchema.optional(),
  cabinets: z.array(cabinetDesignSchema),
  metadata: z.record(z.unknown()).optional(),
  legacyMetadata: z.record(z.unknown()).optional(),
});

export const cabinetDesignDocumentV1Schema = z.object({
  schemaVersion: z.literal(CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION),

  organizationId: z.string().min(1),
  projectId: z.string().min(1),

  units: z.enum(["mm", "in"]),
  revision: z.number().int().nonnegative(),

  projectDefaults: designDefaultsSchema.optional(),

  rooms: z.array(roomDesignSchema),

  constructionProfiles: z.array(profileRefSchema),
  materialProfiles: z.array(profileRefSchema),
  hardwareProfiles: z.array(profileRefSchema),

  legacyMetadata: z.record(z.unknown()).optional(),
});

/**
 * Parses arbitrary JSON into a fully-typed CabinetDesignDocumentV1. Use this
 * on any boundary that ingests a design document (API request bodies, cache
 * hydration, revision snapshot restore).
 */
export function parseCabinetDesignDocumentV1(
  input: unknown,
): CabinetDesignDocumentV1 {
  return cabinetDesignDocumentV1Schema.parse(input) as CabinetDesignDocumentV1;
}

/**
 * Serializes a design document to a canonical JSON string. Deterministic
 * enough for round-trip equality tests; not a stable hash function.
 */
export function serializeCabinetDesignDocumentV1(
  doc: CabinetDesignDocumentV1,
): string {
  return JSON.stringify(doc);
}
