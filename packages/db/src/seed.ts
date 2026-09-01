// Idempotent seed for SYSTEM Scene Asset Definitions.
//
// Reads `DEFAULT_SCENE_ASSET_CATALOG` from `@woodcraft/shared` and
// upserts each entry as a SYSTEM (`scope="system"`, `orgId=null`)
// definition row. The catalog entry's `id` becomes the row's `slug`
// AND its `family` — this way existing SceneAssetInstance rows that
// reference the legacy string id continue to resolve after the
// migration.
//
// Safe to run repeatedly:
//   · Existing rows are updated in place (metadata refreshed).
//   · New rows are inserted with default active=true, systemManaged=true.
//   · Nothing is deleted.
//
// Usage:
//   DATABASE_URL="mysql://…" pnpm --filter @woodcraft/db db:seed
//
// This does NOT upload any GLB. It seeds primitive-only definitions
// today (the default catalog ships primitives). To attach a real GLB
// to a seeded definition, upload it through the Asset Library UI or the
// asset CLI — that creates a new revision on the seeded row's family.

import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_SCENE_ASSET_CATALOG,
  type SceneAssetDefinition,
} from "@woodcraft/shared";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    let created = 0;
    let updated = 0;
    for (const def of DEFAULT_SCENE_ASSET_CATALOG) {
      // Find by slug — the legacy catalog id we're preserving.
      const existing = await prisma.sceneAssetDefinition.findFirst({
        where: { slug: def.id, scope: "system" },
      });
      if (existing) {
        await prisma.sceneAssetDefinition.update({
          where: { id: existing.id },
          data: buildData(def),
        });
        updated++;
      } else {
        // For new rows, family = slug so subsequent revisions attach
        // to the same lineage.
        const row = await prisma.sceneAssetDefinition.create({
          data: {
            ...buildData(def),
            scope: "system",
            orgId: null,
            slug: def.id,
            family: def.id,
            revision: 1,
            active: true,
            systemManaged: true,
          },
        });
        void row;
        created++;
      }
    }
    console.log(
      `[seed] Scene Asset Definitions — created ${created}, updated ${updated}, total ${DEFAULT_SCENE_ASSET_CATALOG.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function buildData(def: SceneAssetDefinition): Record<string, unknown> {
  return {
    name: def.name,
    description: undefined,
    category: def.category,
    widthMm: def.dimensionsMm.widthMm,
    heightMm: def.dimensionsMm.heightMm,
    depthMm: def.dimensionsMm.depthMm,
    placement: def.placement ?? undefined,
    collision: def.collision ?? undefined,
    model: def.model ?? undefined,
    provenance: def.provenance ?? undefined,
    metadata: def.metadata ?? undefined,
    assetKey: def.model?.assetKey ?? null,
    thumbnailKey: def.thumbnailKey ?? def.model?.thumbnailKey ?? null,
    manufacturer: def.manufacturer ?? null,
    sku: def.sku ?? null,
    tags: [],
  };
}

main().catch((err: unknown) => {
  console.error("[seed] FAILED:", (err as Error).message);
  process.exit(1);
});
