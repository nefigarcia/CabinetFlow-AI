/**
 * Syncs cabinet parts from a cad-service geometry response.
 *
 * LEGACY INVARIANT (see packages/shared/src/domain/adapters/legacy-part-sync.ts):
 * The delete filter MUST always constrain to `isManual: false`. Manual parts
 * (`isManual=true`) survive geometry recomputation. Regression-tested via
 * `legacy-part-sync.test.ts` in @woodcraft/shared.
 */
import { prisma } from "@/lib/prisma";
import type { CadPart } from "@/lib/services";
import type { Prisma } from "@woodcraft/db";
import { LEGACY_PARTS_REGENERATION_FILTER } from "@woodcraft/shared";

export async function syncParts(
  cabinetId: string,
  orgId: string,
  cadParts: CadPart[]
): Promise<Prisma.CabinetPartGetPayload<Record<string, never>>[]> {
  await prisma.$transaction([
    // Delete only CAD-computed parts; manual parts survive.
    prisma.cabinetPart.deleteMany({
      where: { cabinetId, ...LEGACY_PARTS_REGENERATION_FILTER },
    }),
    prisma.cabinetPart.createMany({
      data: cadParts.map((p) => ({
        cabinetId,
        orgId,
        name: p.name,
        partType: p.part_type,
        width: p.width,
        height: p.height,
        thickness: p.thickness,
        quantity: p.quantity,
        grainDir: p.grain_dir ?? null,
        edgeBanding: p.edge_banding ? (p.edge_banding as Prisma.InputJsonValue) : undefined,
        cutParams: p.cut_params ? (p.cut_params as Prisma.InputJsonValue) : undefined,
        assemblyGroup: p.assembly_group ?? null,
        isManual: false,
      })),
    }),
  ]);

  return prisma.cabinetPart.findMany({
    where: { cabinetId },
    orderBy: [{ isManual: "asc" }, { assemblyGroup: "asc" }, { partType: "asc" }],
  });
}
