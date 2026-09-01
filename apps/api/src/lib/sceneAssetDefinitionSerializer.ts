import type { SceneAssetDefinition as PrismaRow } from "@woodcraft/db";
import {
  sceneAssetCategorySchema,
  sceneAssetCollisionSchema,
  sceneAssetModelRefSchema,
  sceneAssetPlacementSchema,
  sceneAssetProvenanceSchema,
  type SceneAssetCollision,
  type SceneAssetDefinitionRecord,
  type SceneAssetDefinitionScope,
  type SceneAssetModelRef,
  type SceneAssetPlacement,
  type SceneAssetProvenance,
} from "@woodcraft/shared";

// Prisma ↔ shared-domain projection for scene_asset_definitions.
//
// JSON columns (placement / collision / model / provenance / metadata /
// tags) are parsed defensively — a corrupt blob rehydrates as null so
// consumers get a valid runtime shape instead of throwing.
//
// `serializeSceneAssetDefinition(row)` is the ONLY place that reads
// PrismaSceneAssetDefinition; every route + hook consumes the
// `SceneAssetDefinitionRecord` output.

export function serializeSceneAssetDefinition(
  row: PrismaRow,
): SceneAssetDefinitionRecord {
  return {
    id: row.id,
    scope: coerceScope(row.scope),
    orgId: row.orgId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: coerceCategory(row.category),
    widthMm: Number(row.widthMm),
    heightMm: Number(row.heightMm),
    depthMm: Number(row.depthMm),
    placement: parseOptional<SceneAssetPlacement>(row.placement, sceneAssetPlacementSchema),
    collision: parseOptional<SceneAssetCollision>(row.collision, sceneAssetCollisionSchema),
    model: parseOptional<SceneAssetModelRef>(row.model, sceneAssetModelRefSchema),
    provenance: parseOptional<SceneAssetProvenance>(row.provenance, sceneAssetProvenanceSchema),
    metadata: coerceMetadata(row.metadata),
    assetKey: row.assetKey,
    thumbnailKey: row.thumbnailKey,
    manufacturer: row.manufacturer,
    sku: row.sku,
    tags: coerceTags(row.tags),
    family: row.family,
    revision: row.revision,
    active: row.active,
    systemManaged: row.systemManaged,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function coerceScope(v: string): SceneAssetDefinitionScope {
  return v === "system" ? "system" : "org";
}

function coerceCategory(v: string): SceneAssetDefinitionRecord["category"] {
  const parsed = sceneAssetCategorySchema.safeParse(v);
  // Fallback to a well-formed category if the row was seeded with a
  // legacy string; renderer still works.
  return parsed.success ? parsed.data : "furniture";
}

function coerceMetadata(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function coerceTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
  return [];
}

function parseOptional<T>(v: unknown, schema: { safeParse: (u: unknown) => { success: boolean; data?: unknown } }): T | null {
  if (v == null) return null;
  const result = schema.safeParse(v);
  return result.success ? ((result as { data: T }).data as T) : null;
}
