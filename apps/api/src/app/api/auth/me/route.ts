import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, ok } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/scenePlatformAdmin";
import type { UserRole } from "@woodcraft/shared";

// Middleware verifies access token and sets x-user-id + x-org-id headers.
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return apiError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      orgId: true,
      lastLoginAt: true,
      createdAt: true,
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return apiError("User not found", 404);

  // Server-derived — the client uses it only to decide whether to
  // surface admin controls. Every SYSTEM write path re-checks the same
  // predicate independently.
  const platformAdmin = isPlatformAdmin({
    role: user.role as UserRole,
    email: user.email,
  });

  return ok({ user: { ...user, isPlatformAdmin: platformAdmin } });
}
