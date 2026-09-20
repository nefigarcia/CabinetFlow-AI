// Effective-profile GET for a specific cabinet. Consumed by the
// CabinetInspector's Effective Profile section + non-blocking readiness
// codes.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { buildEffectiveProfileForCabinet } from "@/lib/effective-profile";

type Params = { params: { id: string; roomId: string; cabinetId: string } };

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(_req);
  if (!orgId) return apiError("Unauthorized", 401);

  const cabinet = await prisma.cabinet.findFirst({
    where: { id: params.cabinetId, roomId: params.roomId, orgId },
    select: { parameters: true },
  });
  if (!cabinet) return apiError("Cabinet not found", 404);

  const payload = await buildEffectiveProfileForCabinet({
    orgId,
    projectId: params.id,
    roomId: params.roomId,
    cabinetParameters: cabinet.parameters as Record<string, unknown> | null,
  });

  return ok(payload);
}
