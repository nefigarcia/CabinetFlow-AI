import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { parseBody, quickStartSchema } from "@/lib/validate";
import { apiError, ok } from "@/lib/errors";
import {
  canMutateDesignContent,
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE_ASSIGN,
} from "@/lib/authz";
import { runQuickStart } from "@woodcraft/shared";

// POST /api/onboarding/quick-start
//
// First-run: creates Client + Project + initial Room in ONE transaction
// (all-or-nothing). Design-content mutation — same policy as the
// individual client / project / room create routes. Creates nothing else
// (no cabinets, quotes, materials, CNC data, profiles, org defaults).

export async function POST(req: NextRequest): Promise<Response> {
  const { orgId, role } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);
  if (!canMutateDesignContent(role)) {
    return apiError(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body", 400); }

  const parsed = parseBody(quickStartSchema, body);
  if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

  const result = await runQuickStart(prisma, orgId, parsed.data);
  return ok(result, 201);
}
