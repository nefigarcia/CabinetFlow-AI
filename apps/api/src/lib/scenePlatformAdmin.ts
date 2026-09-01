import type { RequestContext } from "./context";

// Platform-admin authorization SEAM for Scene Asset SYSTEM definitions.
//
// The rest of the CabinetFlow app is strictly per-organization. There
// is no dedicated "platform admin" role today. Until a proper role +
// permission model lands, SYSTEM scene-asset writes are gated on the
// existing `role="owner"` value AND an allow-list controlled by the
// server-only environment variable `SCENE_ASSET_PLATFORM_ADMIN_EMAILS`
// (comma-separated).
//
//   SCENE_ASSET_PLATFORM_ADMIN_EMAILS=admin@example.com,ops@example.com
//
// Rationale:
//   · Role "owner" already exists on the User model and is authoritative
//     (owners can already do anything within their org). Requiring
//     role=owner AND email-allow-list membership avoids accidentally
//     turning every org's owner into a platform admin.
//   · The seam is EXPLICITLY temporary — when we add a real platform-
//     role concept it lives in this file and every caller flips over.
//   · This file is the ONLY place that determines platform-admin
//     eligibility. Every SYSTEM write path calls `isPlatformAdmin(ctx)`.
//
// Read semantics: SYSTEM definitions are ALWAYS readable by any org
// (they're the shared catalog). Only WRITE requires platform admin.

const CACHED_LIST = readAdminList();

function readAdminList(): Set<string> {
  const raw =
    (typeof process !== "undefined" && process.env.SCENE_ASSET_PLATFORM_ADMIN_EMAILS) ||
    "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
}

/** True when the request context represents a platform admin. Never
 *  returns true for org-scoped operations — callers must check scope
 *  first if the endpoint is dual-mode. */
export function isPlatformAdmin(ctx: Pick<RequestContext, "role" | "email">): boolean {
  if (ctx.role !== "owner") return false;
  const email = (ctx.email ?? "").toLowerCase();
  if (email.length === 0) return false;
  return CACHED_LIST.has(email);
}

/** Convenience — read the allow-list at runtime (useful in tests). */
export function _readAdminListForTests(): Set<string> {
  return readAdminList();
}
