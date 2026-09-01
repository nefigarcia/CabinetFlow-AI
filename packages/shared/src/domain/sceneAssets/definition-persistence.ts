import { z } from "zod";
import type { SceneAssetCategory } from "./scene-asset-category";
import { sceneAssetCategorySchema } from "./scene-asset-category";
import type { SceneAssetPlacement } from "./scene-asset-placement";
import { sceneAssetPlacementSchema } from "./scene-asset-placement";
import type { SceneAssetCollision } from "./scene-asset-collision";
import { sceneAssetCollisionSchema } from "./scene-asset-collision";
import type {
  SceneAssetDefinition,
  SceneAssetDimensionsMm,
  SceneAssetModelRef,
  SceneAssetProvenance,
} from "./scene-asset-definition";
import {
  sceneAssetDimensionsMmSchema,
  sceneAssetModelRefSchema,
  sceneAssetProvenanceSchema,
} from "./scene-asset-definition";

// Persistence-adjacent types for the DB-backed Asset Library.
//
// The runtime `SceneAssetDefinition` (see scene-asset-definition.ts) is
// the shape every existing consumer already speaks — loader, catalog,
// filters, room UI, spatial validation. This module layers on:
//
//   · Scope semantics    — SYSTEM vs ORGANIZATION.
//   · Versioning         — every DB row has (family, revision, active).
//   · Create/patch inputs — shapes the API accepts, with orgId + system
//                           flags derived server-side (never from body).
//
// Nothing here changes the domain runtime — a DB row is projected back
// into `SceneAssetDefinition` via `toSceneAssetDefinition(row)` in the
// API serializer.

export type SceneAssetDefinitionScope = "system" | "org";

/**
 * Storage-level record — mirrors the Prisma model 1:1 but with the
 * discriminated `scope` invariant folded in. Consumers should NOT read
 * this shape directly; always project to `SceneAssetDefinition` via
 * `toSceneAssetDefinition`.
 */
export interface SceneAssetDefinitionRecord {
  id: string;
  scope: SceneAssetDefinitionScope;
  orgId: string | null; // null for system, required for org
  slug: string | null;
  name: string;
  description: string | null;
  category: SceneAssetCategory;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  placement: SceneAssetPlacement | null;
  collision: SceneAssetCollision | null;
  model: SceneAssetModelRef | null;
  provenance: SceneAssetProvenance | null;
  metadata: Record<string, unknown> | null;
  assetKey: string | null;
  thumbnailKey: string | null;
  manufacturer: string | null;
  sku: string | null;
  tags: string[];
  family: string;
  revision: number;
  active: boolean;
  systemManaged: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Projects a DB record into the shared runtime `SceneAssetDefinition`
 *  shape that every existing consumer already speaks. */
export function toSceneAssetDefinition(
  row: SceneAssetDefinitionRecord,
): SceneAssetDefinition {
  return {
    // Use the DB row id — the definition's stable identity in the DB.
    // Legacy code-catalog ids remain resolvable via `record.slug`.
    id: row.id,
    version: row.revision,
    name: row.name,
    category: row.category,
    model: row.model ?? undefined,
    dimensionsMm: {
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      depthMm: row.depthMm,
    },
    thumbnailKey: row.thumbnailKey ?? row.model?.thumbnailKey ?? undefined,
    manufacturer: row.manufacturer ?? undefined,
    sku: row.sku ?? undefined,
    placement: row.placement ?? undefined,
    collision: row.collision ?? undefined,
    provenance: row.provenance ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

// ─── Input shapes ────────────────────────────────────────────────────────

/**
 * Everything the API accepts on `POST` when creating a NEW asset
 * definition. `scope` and `orgId` come from the authenticated context,
 * NOT from the client — a client that sends them is silently ignored.
 */
export interface SceneAssetDefinitionCreateInput {
  name: string;
  description?: string;
  category: SceneAssetCategory;
  dimensionsMm: SceneAssetDimensionsMm;
  placement?: SceneAssetPlacement;
  collision?: SceneAssetCollision;
  model?: SceneAssetModelRef;
  provenance?: SceneAssetProvenance;
  manufacturer?: string;
  sku?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Slug — accepted only when the caller is creating a SYSTEM asset that
   *  needs to match a legacy code-catalog id. Ignored for org-scoped
   *  uploads. */
  slug?: string;
  /** Family key — clients can supply this to create a new revision of an
   *  existing family. When omitted, the server generates a fresh family
   *  key equal to the definition's own id. */
  family?: string;
}

export const sceneAssetDefinitionCreateSchema: z.ZodType<SceneAssetDefinitionCreateInput> =
  z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(4000).optional(),
    category: sceneAssetCategorySchema,
    dimensionsMm: sceneAssetDimensionsMmSchema,
    placement: sceneAssetPlacementSchema.optional(),
    collision: sceneAssetCollisionSchema.optional(),
    model: sceneAssetModelRefSchema.optional(),
    provenance: sceneAssetProvenanceSchema.optional(),
    manufacturer: z.string().max(255).optional(),
    sku: z.string().max(191).optional(),
    tags: z.array(z.string().min(1).max(64)).max(32).optional(),
    metadata: z.record(z.unknown()).optional(),
    slug: z.string().min(1).max(191).optional(),
    family: z.string().min(1).max(191).optional(),
  });

/**
 * PATCH input — metadata edits only. To replace the underlying GLB you
 * create a NEW revision (see `SceneAssetDefinitionReviseInput`) — that
 * writes a fresh immutable DB row + S3 objects, never mutates an
 * existing one.
 */
export interface SceneAssetDefinitionPatchInput {
  name?: string;
  description?: string | null;
  category?: SceneAssetCategory;
  dimensionsMm?: SceneAssetDimensionsMm;
  placement?: SceneAssetPlacement | null;
  collision?: SceneAssetCollision | null;
  provenance?: SceneAssetProvenance | null;
  manufacturer?: string | null;
  sku?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  thumbnailKey?: string | null;
  active?: boolean;
}

export const sceneAssetDefinitionPatchSchema: z.ZodType<SceneAssetDefinitionPatchInput> =
  z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(4000).nullable().optional(),
    category: sceneAssetCategorySchema.optional(),
    dimensionsMm: sceneAssetDimensionsMmSchema.optional(),
    placement: sceneAssetPlacementSchema.nullable().optional(),
    collision: sceneAssetCollisionSchema.nullable().optional(),
    provenance: sceneAssetProvenanceSchema.nullable().optional(),
    manufacturer: z.string().max(255).nullable().optional(),
    sku: z.string().max(191).nullable().optional(),
    tags: z.array(z.string()).max(32).nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
    thumbnailKey: z.string().nullable().optional(),
    active: z.boolean().optional(),
  });

// ─── Cross-cutting invariants ────────────────────────────────────────────

/** Enforces the scope/orgId contract: system → orgId null; org → orgId
 *  present. Called by the server AFTER stitching the context-derived
 *  orgId onto the record. */
export function assertScopeConsistent(
  scope: SceneAssetDefinitionScope,
  orgId: string | null,
): void {
  if (scope === "system" && orgId !== null) {
    throw new Error("SYSTEM asset must have orgId=null");
  }
  if (scope === "org" && !orgId) {
    throw new Error("Organization asset must have a non-null orgId");
  }
}

/** True when the caller may READ this record. System records are visible
 *  to every org; org records only to their own org. */
export function canRead(
  record: Pick<SceneAssetDefinitionRecord, "scope" | "orgId" | "active">,
  requester: { orgId: string; isPlatformAdmin: boolean },
): boolean {
  if (!record.active && !requester.isPlatformAdmin) return false;
  if (record.scope === "system") return true;
  return record.orgId === requester.orgId;
}

/** True when the caller may MUTATE this record. */
export function canWrite(
  record: Pick<SceneAssetDefinitionRecord, "scope" | "orgId" | "systemManaged">,
  requester: { orgId: string; isPlatformAdmin: boolean },
): boolean {
  if (record.systemManaged && !requester.isPlatformAdmin) return false;
  if (record.scope === "system") return requester.isPlatformAdmin;
  return record.orgId === requester.orgId;
}
