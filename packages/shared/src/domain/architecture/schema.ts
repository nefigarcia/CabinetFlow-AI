import { z } from "zod";
import { ROOM_ARCHITECTURE_SCHEMA_VERSION } from "./types";

// Zod schemas mirror `types.ts` exactly. Deliberately permissive on
// numeric bounds — validation of physical sanity (positive width, opening
// within wall) belongs in `validation.ts`, not the parse layer, so we can
// preserve broken user input for editor round-trips.
//
// Schemas are declared with inferred types (not `z.ZodType<T>` annotations)
// because Zod's `discriminatedUnion` requires raw `z.object(...)` inputs
// — the annotation form widens the input to a plain ZodType which the
// discriminated-union constructor rejects.

const vec2MmSchema = z.object({
  x: z.number(),
  z: z.number(),
});

const doorOpeningSchema = z.object({
  id: z.string().min(1),
  type: z.literal("door"),
  offsetMm: z.number(),
  widthMm: z.number(),
  heightMm: z.number(),
  hingeSide: z.enum(["left", "right"]).optional(),
  swingDirection: z.enum(["inward", "outward"]).optional(),
  label: z.string().optional(),
});

const windowOpeningSchema = z.object({
  id: z.string().min(1),
  type: z.literal("window"),
  offsetMm: z.number(),
  widthMm: z.number(),
  heightMm: z.number(),
  sillHeightMm: z.number(),
  label: z.string().optional(),
});

const genericOpeningSchema = z.object({
  id: z.string().min(1),
  type: z.literal("opening"),
  offsetMm: z.number(),
  widthMm: z.number(),
  heightMm: z.number(),
  sillHeightMm: z.number().optional(),
  label: z.string().optional(),
});

const wallOpeningSchema = z.discriminatedUnion("type", [
  doorOpeningSchema,
  windowOpeningSchema,
  genericOpeningSchema,
]);

const wallDefinitionSchema = z.object({
  id: z.string().min(1),
  startMm: vec2MmSchema,
  endMm: vec2MmSchema,
  heightMm: z.number(),
  thicknessMm: z.number(),
  openings: z.array(wallOpeningSchema),
});

const floorSchema = z.object({}).passthrough();

const ceilingSchema = z.object({
  visibility: z.enum(["auto", "visible", "hidden"]).optional(),
});

export const roomArchitectureSchema = z.object({
  schemaVersion: z.literal(ROOM_ARCHITECTURE_SCHEMA_VERSION),
  floor: floorSchema.optional(),
  ceiling: ceilingSchema.optional(),
  walls: z.array(wallDefinitionSchema),
});
