import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { loadOnboardingStatus } from "@woodcraft/shared";

// GET /api/onboarding/status
//
// Read-only activation status DERIVED from the caller's org data
// (clients / projects / rooms / cabinets). `activated` ⇔ cabinets > 0.
// Any authenticated org member may read it; every query is org-scoped.

export async function GET(req: NextRequest): Promise<Response> {
  const { orgId } = getContext(req);
  if (!orgId) return apiError("Unauthorized", 401);

  const status = await loadOnboardingStatus(prisma, orgId);
  return ok(status);
}
