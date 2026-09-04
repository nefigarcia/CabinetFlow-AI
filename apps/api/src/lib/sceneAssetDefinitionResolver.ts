import type { PrismaClient } from "@woodcraft/db";
import {
  DEFAULT_SCENE_ASSET_CATALOG,
  canReadSceneAssetDefinition,
  toSceneAssetDefinition,
  type SceneAssetDefinition,
  type SceneAssetDefinitionRecord,
} from "@woodcraft/shared";
import { serializeSceneAssetDefinition } from "./sceneAssetDefinitionSerializer";

// Canonical server-side SceneAssetDefinition resolver.
//
// The DB is the RUNTIME SOURCE OF TRUTH. Every placement + hydration
// path routes through here so validation semantics live in ONE file.
//
// Two variants, deliberately named for the caller's INTENT — not for
// the "active" flag mechanics:
//   · `resolveDefinitionForPlacement`  — active only (new placements
//     of archived rows are refused).
//   · `resolveDefinitionForExistingInstance` — active OR archived
//     (historic rooms must keep rendering even after their asset is
//     archived).
//
// Legacy fallback: when a lookup misses the DB entirely, we check
// `DEFAULT_SCENE_ASSET_CATALOG` for a matching id — this keeps rooms
// with pre-DB-catalog SceneAssetInstance rows (whose assetDefinitionId
// is a static slug like "refrigerator-36-generic") renderable. The
// legacy fallback is ONLY consulted for existing-instance resolution;
// new placements MUST use a DB-backed id.

// ─── Tenancy check ─────────────────────────────────────────────────────
//
// Delegated to the shared `canReadSceneAssetDefinition` helper (see
// packages/shared/src/domain/sceneAssets/definition-persistence.ts) so
// the read rule lives in ONE place across the codebase.
//
// One quirk: shared `canReadSceneAssetDefinition` also filters out
// records with `active=false` (matching the Asset Library's default
// browsing view). For the RESOLVER we need finer control — placement
// respects active; existing-instance resolution does not. So we call
// it with `active=true` forced, then apply the archived rule
// separately per variant.
function canReadRecord(
  record: Pick<SceneAssetDefinitionRecord, "scope" | "orgId">,
  requester: { orgId: string },
): boolean {
  return canReadSceneAssetDefinition(
    { ...record, active: true },
    { ...requester, isPlatformAdmin: false },
  );
}

// ─── Placement resolver ────────────────────────────────────────────────

/**
 * Resolves a definition for a NEW placement.
 *   · Must exist in the DB.
 *   · Must be active (archived rows are refused).
 *   · Must be readable by the caller (system OR own-org).
 * Returns null on any failure — the caller distinguishes "unknown id"
 * vs "no access" vs "archived" via `explainPlacementRejection` when it
 * needs a granular error message.
 */
export async function resolveDefinitionForPlacement(input: {
  prisma: PrismaClient;
  definitionId: string;
  orgId: string;
}): Promise<{ record: SceneAssetDefinitionRecord; runtime: SceneAssetDefinition } | null> {
  const row = await input.prisma.sceneAssetDefinition.findUnique({
    where: { id: input.definitionId },
  });
  if (!row) return null;
  const record = serializeSceneAssetDefinition(row);
  if (!record.active) return null;
  if (!canReadRecord(record, { orgId: input.orgId })) return null;
  return { record, runtime: toSceneAssetDefinition(record) };
}

/**
 * Placement-time diagnostics — used only when the resolver returns
 * null and the caller wants a specific 4xx reason. Runs a targeted
 * second query to distinguish the failure modes; keeps the hot path
 * (successful placement) fast by staying out of it entirely.
 */
export async function explainPlacementRejection(input: {
  prisma: PrismaClient;
  definitionId: string;
  orgId: string;
}): Promise<{
  reason: "not-found" | "no-access" | "archived";
  status: 404 | 403 | 410;
  message: string;
}> {
  const row = await input.prisma.sceneAssetDefinition.findUnique({
    where: { id: input.definitionId },
  });
  if (!row) {
    return {
      reason: "not-found",
      status: 404,
      message: `Unknown asset definition "${input.definitionId}".`,
    };
  }
  const record = serializeSceneAssetDefinition(row);
  if (!canReadRecord(record, { orgId: input.orgId })) {
    // Do not leak cross-org existence — return 404 to non-owners, not 403.
    return {
      reason: "not-found",
      status: 404,
      message: `Unknown asset definition "${input.definitionId}".`,
    };
  }
  if (!record.active) {
    return {
      reason: "archived",
      status: 410,
      message: `Asset definition "${record.name}" is archived and cannot be placed. Restore it in the Asset Library to reuse it.`,
    };
  }
  // Shouldn't happen — the primary resolver would have succeeded.
  return {
    reason: "no-access",
    status: 403,
    message: `Access denied for asset definition "${input.definitionId}".`,
  };
}

// ─── Existing-instance resolver ────────────────────────────────────────

/**
 * Resolves a definition for RENDERING an existing SceneAssetInstance.
 *   · Accepts active AND archived rows.
 *   · Enforces tenancy — an instance in your room referencing another
 *     org's private asset resolves to null (defense in depth).
 *   · Falls back to `DEFAULT_SCENE_ASSET_CATALOG` when the DB has no
 *     matching id — this covers pre-DB legacy instances.
 * Returns null when nothing matches; the renderer silently skips.
 */
export async function resolveDefinitionForExistingInstance(input: {
  prisma: PrismaClient;
  definitionId: string;
  orgId: string;
}): Promise<{ runtime: SceneAssetDefinition } | null> {
  const row = await input.prisma.sceneAssetDefinition.findUnique({
    where: { id: input.definitionId },
  });
  if (row) {
    const record = serializeSceneAssetDefinition(row);
    if (canReadRecord(record, { orgId: input.orgId })) {
      return { runtime: toSceneAssetDefinition(record) };
    }
    // Cross-org private asset — treat as absent from this tenant's
    // perspective. Fall through to the static fallback so a legacy id
    // still resolves if applicable.
  }
  const legacy = resolveLegacyStaticDefinition(input.definitionId);
  return legacy ? { runtime: legacy } : null;
}

/**
 * Legacy code-catalog fallback. Returns a static `SceneAssetDefinition`
 * from `DEFAULT_SCENE_ASSET_CATALOG` when the id matches. Exposed
 * separately so the seed script + tests can share the lookup without
 * hitting the DB.
 */
export function resolveLegacyStaticDefinition(
  definitionId: string,
): SceneAssetDefinition | null {
  const hit = DEFAULT_SCENE_ASSET_CATALOG.find((d) => d.id === definitionId);
  return hit ?? null;
}
