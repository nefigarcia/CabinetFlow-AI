import type { Cabinet, CabinetPart } from "../../types/cabinet";
import type {
  CabinetDesign,
  CabinetIntentParameters,
  CabinetRole,
  PartDesign,
  PartDimensionsMm,
  PartEdgeBanding,
  PartGrainDirection,
  RoomDesign,
  RoomDimensionsMm,
  Vec3Mm,
} from "../design-document";
import { partGenerationModeFromLegacyIsManual } from "../parts/generation-mode";

// The legacy adapter maps the current production `Cabinet` shape (as defined
// in `packages/shared/src/types/cabinet.ts`) into a V2 `CabinetDesign` node
// WITHOUT reinterpreting values, WITHOUT introducing profile references it
// cannot verify, and WITHOUT discarding unknown fields from
// `Cabinet.parameters` or `CabinetPart.cutParams`.
//
// Adapters are pure and lossless in the reverse direction for known fields;
// legacy metadata that has no V2 home is preserved verbatim in
// `legacyParameters` / `legacyMetadata` slots.

const KNOWN_INTENT_KEYS = new Set([
  "role",
  "doorCount",
  "drawerCount",
  "shelfCount",
  "columns",
  "rows",
  "finishStyle",
  "notes",
]);

const VALID_ROLES: readonly CabinetRole[] = [
  "cabinet",
  "opening",
  "led_strip",
  "open_shelf",
];

function asRole(v: unknown): CabinetRole | undefined {
  if (typeof v !== "string") return undefined;
  return (VALID_ROLES as readonly string[]).includes(v)
    ? (v as CabinetRole)
    : undefined;
}

function asPositiveInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v < 0) return undefined;
  if (!Number.isInteger(v)) return undefined;
  return v;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asGrainDirection(v: unknown): PartGrainDirection | undefined {
  return v === "horizontal" || v === "vertical" || v === "none"
    ? (v as PartGrainDirection)
    : undefined;
}

function partOverridesFromLegacy(
  part: CabinetPart,
): PartDesign["overrides"] | undefined {
  const grainDir = asGrainDirection(part.grainDir);
  const edgeBanding: Partial<PartEdgeBanding> | undefined = part.edgeBanding
    ? {
        top: !!part.edgeBanding.top,
        bottom: !!part.edgeBanding.bottom,
        left: !!part.edgeBanding.left,
        right: !!part.edgeBanding.right,
      }
    : undefined;
  if (!grainDir && !edgeBanding) return undefined;
  const overrides: PartDesign["overrides"] = {};
  if (grainDir) overrides.grainDir = grainDir;
  if (edgeBanding) overrides.edgeBanding = edgeBanding;
  return overrides;
}

/**
 * Adapts a single legacy `CabinetPart` into a V2 `PartDesign` node.
 * Unknown legacy data lands in `legacyCutParams` and `legacyMetadata` so
 * downstream consumers can still access it during migration.
 */
export function adaptLegacyPart(part: CabinetPart): PartDesign {
  const dimensions: PartDimensionsMm = {
    widthMm: part.width,
    heightMm: part.height,
    thicknessMm: part.thickness,
  };

  const legacyMetadata: Record<string, unknown> = {};
  if (part.assemblyGroup) legacyMetadata["assemblyGroup"] = part.assemblyGroup;
  if (part.orgId) legacyMetadata["orgId"] = part.orgId;
  if (part.cabinetId) legacyMetadata["cabinetId"] = part.cabinetId;
  if (part.createdAt) legacyMetadata["createdAt"] = part.createdAt;
  if (part.updatedAt) legacyMetadata["updatedAt"] = part.updatedAt;

  const design: PartDesign = {
    id: part.id,
    name: part.name,
    partType: part.partType,
    generationMode: partGenerationModeFromLegacyIsManual(part.isManual),
    quantity: part.quantity,
    dimensions,
  };

  if (part.materialId) {
    design.materialProfileRef = { id: part.materialId, version: 1 };
  }
  const overrides = partOverridesFromLegacy(part);
  if (overrides) design.overrides = overrides;
  if (part.cutParams) design.legacyCutParams = { ...part.cutParams };
  if (Object.keys(legacyMetadata).length > 0) design.legacyMetadata = legacyMetadata;

  return design;
}

/**
 * Adapts a single legacy `Cabinet` into a V2 `CabinetDesign` node. Every
 * unknown key in `Cabinet.parameters` is preserved TWICE: once in the typed
 * `parameters.extra` bag (surfaced to callers who want to keep using it) and
 * once in the untyped `legacyParameters` bag (guaranteed verbatim for audit).
 * This lets the migration remove either safely later.
 */
export function adaptLegacyCabinet(cabinet: Cabinet): CabinetDesign {
  const params = cabinet.parameters ?? {};
  const extra: Record<string, unknown> = {};
  const legacyParameters: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (KNOWN_INTENT_KEYS.has(key)) continue;
    extra[key] = value;
    legacyParameters[key] = value;
  }

  const parameters: CabinetIntentParameters = {};
  const role = asRole(params["role"]);
  if (role) parameters.role = role;
  const doorCount = asPositiveInt(params["doorCount"]);
  if (doorCount !== undefined) parameters.doorCount = doorCount;
  const drawerCount = asPositiveInt(params["drawerCount"]);
  if (drawerCount !== undefined) parameters.drawerCount = drawerCount;
  const shelfCount = asPositiveInt(params["shelfCount"]);
  if (shelfCount !== undefined) parameters.shelfCount = shelfCount;
  const columns = asPositiveInt(params["columns"]);
  if (columns !== undefined && columns > 0) parameters.columns = columns;
  const rows = asPositiveInt(params["rows"]);
  if (rows !== undefined && rows > 0) parameters.rows = rows;
  const finishStyle = asString(params["finishStyle"]);
  if (finishStyle) parameters.finishStyle = finishStyle;
  const notes = asString(params["notes"]);
  if (notes) parameters.notes = notes;
  if (Object.keys(extra).length > 0) parameters.extra = extra;

  const position: Vec3Mm = { x: cabinet.posX, y: cabinet.posY, z: cabinet.posZ };

  const design: CabinetDesign = {
    id: cabinet.id,
    type: cabinet.type,
    name: cabinet.name,
    position,
    dimensions: {
      widthMm: cabinet.width,
      heightMm: cabinet.height,
      depthMm: cabinet.depth,
    },
    parameters,
    parts: cabinet.parts.map(adaptLegacyPart),
  };

  if (cabinet.materialId) {
    design.materialProfileRef = { id: cabinet.materialId, version: 1 };
  }
  if (Object.keys(legacyParameters).length > 0) {
    design.legacyParameters = legacyParameters;
  }

  return design;
}

export interface LegacyRoomLike {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  metadata?: Record<string, unknown> | null;
}

/**
 * Adapts a legacy room shape into a V2 `RoomDesign`. The `cabinets` array is
 * supplied separately so callers can hydrate cabinets from any source
 * (Prisma include, cache, revision snapshot).
 */
export function adaptLegacyRoom(
  room: LegacyRoomLike,
  cabinets: Cabinet[],
): RoomDesign {
  const dimensions: RoomDimensionsMm = {
    widthMm: room.width,
    heightMm: room.height,
    depthMm: room.depth,
  };
  const design: RoomDesign = {
    id: room.id,
    name: room.name,
    dimensions,
    cabinets: cabinets.map(adaptLegacyCabinet),
  };
  if (room.metadata && Object.keys(room.metadata).length > 0) {
    design.legacyMetadata = { ...room.metadata };
  }
  return design;
}
