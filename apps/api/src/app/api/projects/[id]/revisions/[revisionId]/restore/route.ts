import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import {
  snapshotPartToPrismaData,
  type LegacySnapshotPart,
} from "@woodcraft/shared";

type Params = { params: { id: string; revisionId: string } };

interface SnapshotRoom {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  metadata: unknown;
  cabinets: SnapshotCabinet[];
}

interface SnapshotCabinet {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  posX: number;
  posY: number;
  posZ: number;
  parameters: unknown;
  materialId: string | null;
  parts: LegacySnapshotPart[];
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  const revision = await prisma.revision.findFirst({
    where: { id: params.revisionId, projectId: params.id, orgId },
  });
  if (!revision) return apiError("Revision not found", 404);

  const snapshot = revision.snapshot as unknown as SnapshotRoom[];

  // First, save a new revision of the current state so the restore is reversible
  const currentSnapshot = await prisma.room.findMany({
    where: { projectId: params.id, orgId },
    include: { cabinets: { include: { parts: true } } },
  });
  const latestVersion = await prisma.revision.findFirst({
    where: { projectId: params.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await prisma.revision.create({
    data: {
      projectId: params.id,
      orgId,
      userId: getContext(req).userId,
      version: (latestVersion?.version ?? 0) + 1,
      snapshot: currentSnapshot as any,
      message: `Auto-saved before restoring to v${revision.version}`,
    },
  });

  // Restore: wipe all rooms + cabinets + parts, then recreate from snapshot
  await prisma.room.deleteMany({ where: { projectId: params.id, orgId } });

  for (const roomSnap of snapshot) {
    await prisma.room.create({
      data: {
        id: roomSnap.id,
        projectId: params.id,
        orgId,
        name: roomSnap.name,
        width: roomSnap.width,
        height: roomSnap.height,
        depth: roomSnap.depth,
        metadata: roomSnap.metadata as any ?? undefined,
        cabinets: {
          create: roomSnap.cabinets.map((cab) => ({
            id: cab.id,
            orgId,
            type: cab.type,
            name: cab.name,
            width: cab.width,
            height: cab.height,
            depth: cab.depth,
            posX: cab.posX,
            posY: cab.posY,
            posZ: cab.posZ,
            parameters: cab.parameters as any,
            materialId: cab.materialId ?? undefined,
            parts: {
              // Preserve `isManual` from the snapshot so manual/custom parts
              // survive a restore. Historical snapshots that predate V2.1A.1
              // may not carry `isManual`; the mapper defaults it to false.
              // Cast at the Prisma boundary: the mapper is intentionally
              // Prisma-agnostic and types edgeBanding/cutParams as unknown.
              create: cab.parts.map((p) => snapshotPartToPrismaData(p, orgId)) as any,
            },
          })),
        },
      },
    });
  }

  return ok({
    message: `Project restored to revision v${revision.version}`,
    restoredRevisionId: revision.id,
    restoredVersion: revision.version,
  });
}
