import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/scenePlatformAdmin";
import { serializeSceneAssetDefinition } from "@/lib/sceneAssetDefinitionSerializer";
import { canReadSceneAssetDefinition } from "@woodcraft/shared";

// GET /scene-asset-definitions/[id]/usage
//
// Returns a lightweight usage summary used by the Asset Library archive
// safety UI. Never surfaces cross-org instance ids — only counts of
// instances the caller may already see + counts of instances outside
// their tenancy that this definition is used by (for admin awareness).

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const row = await prisma.sceneAssetDefinition.findUnique({ where: { id: params.id } });
  if (!row) return apiError("Not found", 404);
  const record = serializeSceneAssetDefinition(row);
  const requester = { orgId: ctx.orgId, isPlatformAdmin: isPlatformAdmin(ctx) };
  if (!canReadSceneAssetDefinition(record, requester)) return apiError("Not found", 404);

  // The `assetDefinitionId` column stores either the DB row id or the
  // legacy code-catalog slug — count against BOTH.
  const idsInPlay = [record.id, ...(record.slug ? [record.slug] : [])];

  const [totalCount, ownOrgCount] = await Promise.all([
    prisma.sceneAssetInstance.count({
      where: { assetDefinitionId: { in: idsInPlay } },
    }),
    prisma.sceneAssetInstance.count({
      where: {
        assetDefinitionId: { in: idsInPlay },
        orgId: ctx.orgId,
      },
    }),
  ]);

  return ok({
    definitionId: record.id,
    slug: record.slug,
    total: totalCount,
    inMyOrganization: ownOrgCount,
    // Non-admins only see their own org's total; admins see both.
    inOtherOrganizations: requester.isPlatformAdmin ? totalCount - ownOrgCount : null,
  });
}
