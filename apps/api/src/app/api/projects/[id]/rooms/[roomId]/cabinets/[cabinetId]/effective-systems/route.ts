// Effective-systems GET for a specific cabinet (Phase 2). Consumed by
// the CabinetInspector's Cabinet Systems section + readiness warnings.
// Metadata + readiness only — never triggers CAD or BOM.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { buildEffectiveSystemsForCabinet } from "@/lib/effective-systems";
import type { CabinetType } from "@woodcraft/shared";

type Params = { params: { id: string; roomId: string; cabinetId: string } };

const KNOWN_CABINET_TYPES: readonly CabinetType[] = [
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
];

function toCabinetType(v: unknown): CabinetType {
  return typeof v === "string" && (KNOWN_CABINET_TYPES as readonly string[]).includes(v)
    ? (v as CabinetType)
    : "base";
}

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { orgId } = getContext(_req);
  if (!orgId) return apiError("Unauthorized", 401);

  const cabinet = await prisma.cabinet.findFirst({
    where: { id: params.cabinetId, roomId: params.roomId, orgId },
    select: { parameters: true, type: true },
  });
  if (!cabinet) return apiError("Cabinet not found", 404);

  const payload = await buildEffectiveSystemsForCabinet({
    orgId,
    projectId: params.id,
    roomId: params.roomId,
    cabinetType: toCabinetType(cabinet.type),
    cabinetParameters: cabinet.parameters as Record<string, unknown> | null,
  });

  return ok(payload);
}
