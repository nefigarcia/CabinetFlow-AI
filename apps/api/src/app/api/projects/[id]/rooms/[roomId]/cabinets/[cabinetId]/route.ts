import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, updateCabinetSchema } from "@/lib/validate";
import { cadService } from "@/lib/services";
import { syncParts } from "@/lib/parts";
import { apiError, ok } from "@/lib/errors";
import {
  CABINET_PROFILE_REF_KEYS,
  CABINET_SYSTEM_REF_KEYS,
  applyCabinetParametersPatch,
  assertSystemBelongsToOrg,
  doesParameterChangeRequireCadRecompute,
  ProfileInheritance,
} from "@woodcraft/shared";
import {
  canAssignCabinetSystems,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
} from "@/lib/authz";

type Params = { params: { id: string; roomId: string; cabinetId: string } };

async function findCabinet(cabinetId: string, roomId: string, projectId: string, orgId: string) {
  return prisma.cabinet.findFirst({
    where: {
      id: cabinetId,
      orgId,
      roomId,
      room: { projectId },
    },
    include: { parts: { orderBy: { partType: "asc" } }, material: true },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  const cabinet = await findCabinet(params.cabinetId, params.roomId, params.id, orgId);
  if (!cabinet) return apiError("Cabinet not found", 404);

  return ok(cabinet);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId, role } = getContext(req);
  // Phase 2.1 authorization: cabinet edits (including Phase 2 system
  // overrides) require owner/admin/designer. Viewers are forbidden from
  // ANY cabinet mutation, not just system fields — matches the spec's
  // "viewer forbidden" cabinet-edit rule.
  if (!canAssignCabinetSystems(role)) {
    return apiError(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body", 400); }

  const parsed = parseBody(updateCabinetSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const existing = await findCabinet(params.cabinetId, params.roomId, params.id, orgId);
  if (!existing) return apiError("Cabinet not found", 404);

  if (parsed.data.materialId) {
    const mat = await prisma.material.findFirst({ where: { id: parsed.data.materialId, orgId } });
    if (!mat) return apiError("Material not found", 404);
  }

  // ── Canonical parameters merge ─────────────────────────────────────────────
  // Uses the shared `applyCabinetParametersPatch` helper so profile-ref
  // and wallPlacement deletion (`null` in patch) correctly REMOVE keys
  // from the JSON bag. Prior inline shallow-spread pattern is retired.
  const parametersWasPatched = parsed.data.parameters !== undefined;
  const existingParameters = existing.parameters as Record<string, unknown>;
  const nextParameters = applyCabinetParametersPatch(
    existingParameters,
    parsed.data.parameters,
  );

  // ── Tenancy: any non-null profile ref in the patch must belong to org ─────
  // Deletions (`null`) skip the lookup by design. Rejection returns 404
  // uniformly — no metadata leak about cross-org profiles.
  const incomingParams: Record<string, unknown> | undefined = parsed.data.parameters;
  if (incomingParams) {
    for (const key of CABINET_PROFILE_REF_KEYS) {
      const value = incomingParams[key];
      if (typeof value !== "string" || value.length === 0) continue;
      const row =
        key === "constructionProfileId"
          ? await prisma.constructionProfile.findFirst({
              where: { id: value, orgId },
              select: { id: true, orgId: true },
            })
          : key === "materialProfileId"
            ? await prisma.cabinetMaterialProfile.findFirst({
                where: { id: value, orgId },
                select: { id: true, orgId: true },
              })
            : await prisma.hardwareProfile.findFirst({
                where: { id: value, orgId },
                select: { id: true, orgId: true },
              });
      const check = ProfileInheritance.assertProfileBelongsToOrg(row, orgId);
      if (!check.ok) return apiError("Profile not found", 404);
    }

    // Phase 2 system refs (familyRuleId, frontSystemId, drawerSystemId).
    // Same uniform 404 posture as profile refs.
    for (const key of CABINET_SYSTEM_REF_KEYS) {
      const value = incomingParams[key];
      if (typeof value !== "string" || value.length === 0) continue;

      if (key === "familyRuleId") {
        const row = await prisma.cabinetFamilyRule.findFirst({
          where: { id: value, orgId },
          select: { id: true, orgId: true, cabinetType: true },
        });
        const check = assertSystemBelongsToOrg(row, orgId);
        if (!check.ok) return apiError("Not found", 404);
        // Phase 2.1 semantic guard: familyRule.cabinetType must match the
        // cabinet's own type. Prevents assigning a Wall family rule to a
        // Base cabinet. Server is authoritative — UI may filter dropdowns,
        // but any bypass rejects here.
        if (row && row.cabinetType !== existing.type) {
          return apiError(
            `Family rule '${value}' targets cabinetType='${row.cabinetType}' but this cabinet is type='${existing.type}'.`,
            422,
            "VALIDATION_ERROR",
          );
        }
        continue;
      }

      const row =
        key === "frontSystemId"
          ? await prisma.frontSystem.findFirst({
              where: { id: value, orgId },
              select: { id: true, orgId: true },
            })
          : await prisma.drawerSystem.findFirst({
              where: { id: value, orgId },
              select: { id: true, orgId: true },
            });
      const check = assertSystemBelongsToOrg(row, orgId);
      if (!check.ok) return apiError("Not found", 404);
    }
  }

  const updated = await prisma.cabinet.update({
    where: { id: params.cabinetId },
    data: {
      ...parsed.data,
      // Overwrite the parameters column ONLY when the caller sent a
      // `parameters` key. Prevents no-op writes to a JSON column.
      ...(parametersWasPatched && { parameters: nextParameters }),
    },
  });

  // ── Constraint propagation ─────────────────────────────────────────────────
  // CAD recompute detection compares PREVIOUS-final vs NEXT-final params
  // so deletion of a deletable key (profile ref / wallPlacement — both
  // classified as non-manufacturing) does NOT trigger a recompute.
  //
  // Explicit rules:
  //   · Width / height / depth change → recompute.
  //   · `parameters` change → recompute ONLY when a "manufacturing"
  //     -classified key changed (see PARAMETER_IMPACT). Unknown keys
  //     default to "manufacturing" — safe default: worst case is an
  //     extra CAD call, not a missed one.
  const dimensionOnlyChange =
    parsed.data.width !== undefined ||
    parsed.data.height !== undefined ||
    parsed.data.depth !== undefined;
  const manufacturingParameterChanged = parametersWasPatched
    ? doesParameterChangeRequireCadRecompute(existingParameters, nextParameters)
    : false;
  const dimensionsChanged = dimensionOnlyChange || manufacturingParameterChanged;

  let parts = existing.parts;
  const cadWarnings: string[] = [];

  if (dimensionsChanged) {
    const geometry = await cadService
      .computeGeometry({
        cabinet_id: updated.id,
        type: updated.type,
        width: Number(updated.width),
        height: Number(updated.height),
        depth: Number(updated.depth),
        parameters: (parametersWasPatched ? nextParameters : existing.parameters) as Record<string, unknown>,
        material_thickness: 18,
      })
      .catch((err: unknown) => {
        console.error("[cad-service] geometry recompute failed:", err);
        return null;
      });

    if (geometry) {
      parts = await syncParts(updated.id, orgId, geometry.parts);
      cadWarnings.push(...geometry.warnings);
    }
    // If cad-service is unavailable, return stale parts — caller sees _cadWarnings
  }

  return ok({ ...updated, parts, _cadWarnings: cadWarnings });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId } = getContext(req);

  const existing = await findCabinet(params.cabinetId, params.roomId, params.id, orgId);
  if (!existing) return apiError("Cabinet not found", 404);

  await prisma.cabinet.delete({ where: { id: params.cabinetId } });
  return ok({ id: params.cabinetId });
}
