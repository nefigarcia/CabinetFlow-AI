import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/lib/context";
import { apiError, ok } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/scenePlatformAdmin";
import { serializeSceneAssetDefinition } from "@/lib/sceneAssetDefinitionSerializer";
import {
  ingestSceneAsset,
  loadUploadConfigOrThrow,
} from "@/lib/sceneAssetUploadService";
import {
  DEFAULT_SCENE_ASSET_CATALOG,
  sceneAssetCategorySchema,
  sceneAssetCollisionSchema,
  sceneAssetDefinitionCreateSchema,
  sceneAssetPlacementSchema,
  sceneAssetProvenanceSchema,
  type SceneAssetProvenance,
} from "@woodcraft/shared";

// ─── GET /api/scene-asset-definitions ───────────────────────────────────
//
// Returns every definition visible to the caller — SYSTEM + own-org.
// Never leaks another org's records. When the caller is a platform
// admin, the archived-only filter is still honoured (this endpoint is
// the read path; the admin overview uses ?active=any).
//
// Query params:
//   scope:  "system" | "org" | "all"   (default "all")
//   active: "true" | "false" | "any"   (default "true")
//   category: any SceneAssetCategory   (optional filter)

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const scopeParam = (url.searchParams.get("scope") ?? "all").toLowerCase();
  const activeParam = (url.searchParams.get("active") ?? "true").toLowerCase();
  const categoryParam = url.searchParams.get("category");

  const admin = isPlatformAdmin(ctx);

  // Tenancy: every non-admin request is restricted to system + own-org.
  const visibilityFilter =
    scopeParam === "system"
      ? { scope: "system" as const }
      : scopeParam === "org"
        ? { scope: "org" as const, orgId: ctx.orgId }
        : {
            OR: [
              { scope: "system" as const },
              { scope: "org" as const, orgId: ctx.orgId },
            ],
          };

  const activeFilter =
    activeParam === "true"
      ? { active: true }
      : activeParam === "false"
        ? { active: false }
        : {};
  // Non-admins cannot request archived rows.
  if (!admin && activeParam !== "true") {
    return apiError("Archived listing is restricted", 403);
  }

  const categoryFilter =
    categoryParam && sceneAssetCategorySchema.safeParse(categoryParam).success
      ? { category: categoryParam }
      : {};

  const rows = await prisma.sceneAssetDefinition.findMany({
    where: { ...visibilityFilter, ...activeFilter, ...categoryFilter },
    orderBy: [{ category: "asc" }, { name: "asc" }, { revision: "desc" }],
  });

  return ok(rows.map(serializeSceneAssetDefinition));
}

// ─── POST /api/scene-asset-definitions ──────────────────────────────────
//
// Multipart-form upload — creates a NEW asset definition and uploads
// its GLB + thumbnail to S3 through the shared upload service.
//
// Fields (multipart/form-data):
//   metadata   → JSON string matching sceneAssetDefinitionCreateSchema
//   model      → GLB file
//   thumbnail? → image file (optional)
//   scope      → "system" | "org" (optional; defaults "org")

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = getContext(req);
  if (!ctx.orgId) return apiError("Unauthorized", 401);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return apiError("Expected multipart/form-data", 415);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return apiError(`Malformed multipart body: ${(err as Error).message}`, 400);
  }

  const metadataRaw = form.get("metadata");
  if (typeof metadataRaw !== "string") {
    return apiError("Missing `metadata` field", 400);
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (err) {
    return apiError(`Invalid metadata JSON: ${(err as Error).message}`, 400);
  }
  const parsed = sceneAssetDefinitionCreateSchema.safeParse(metadata);
  if (!parsed.success) {
    return apiError(
      `Validation error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      422,
      "VALIDATION_ERROR",
    );
  }
  const data = parsed.data;

  // Provenance is REQUIRED on the create path — you cannot upload a GLB
  // without a license.
  if (!data.provenance) {
    return apiError("provenance (source + license) is required for GLB uploads", 422);
  }

  // Scope + admin gate.
  const requestedScope = (form.get("scope") ?? "org").toString();
  const scope = requestedScope === "system" ? "system" : "org";
  const admin = isPlatformAdmin(ctx);
  if (scope === "system" && !admin) {
    return apiError("SYSTEM assets require platform admin", 403);
  }

  // Files.
  const modelFile = form.get("model");
  if (!(modelFile instanceof File)) {
    return apiError("Missing `model` file", 400);
  }
  const modelBuf = Buffer.from(await modelFile.arrayBuffer());

  const thumbnailFile = form.get("thumbnail");
  const thumbnailBuf =
    thumbnailFile instanceof File && thumbnailFile.size > 0
      ? Buffer.from(await thumbnailFile.arrayBuffer())
      : null;

  // Config: check server env is configured.
  let config;
  try {
    config = loadUploadConfigOrThrow();
  } catch (err) {
    return apiError((err as Error).message, 500);
  }

  // Reject slug collision — a legacy code-catalog id must not be
  // shadowed silently.
  if (data.slug) {
    const collision = await prisma.sceneAssetDefinition.findFirst({
      where: { slug: data.slug },
    });
    if (collision) {
      return apiError(`Slug "${data.slug}" is already used by definition ${collision.id}`, 409);
    }
  }

  try {
    const result = await ingestSceneAsset({
      prisma,
      config,
      ingest: {
        scope,
        orgId: scope === "system" ? null : ctx.orgId,
        systemManaged: scope === "system",
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        dimensionsMm: data.dimensionsMm,
        placement: data.placement,
        collision: data.collision,
        provenance: data.provenance as SceneAssetProvenance,
        manufacturer: data.manufacturer ?? null,
        sku: data.sku ?? null,
        tags: data.tags,
        metadata: data.metadata ?? null,
        slug: data.slug ?? null,
        family: data.family ?? null,
        modelFile: { filename: modelFile.name || "model.glb", body: modelBuf },
        thumbnailFile: thumbnailBuf
          ? { filename: (thumbnailFile as File).name || "thumbnail.webp", body: thumbnailBuf }
          : undefined,
      },
    });
    return ok(
      { record: result.record, warnings: result.warnings },
      201,
    );
  } catch (err) {
    return apiError(`Upload failed: ${(err as Error).message}`, 500);
  }
}

// Silence unused imports — the schemas are re-used by the shared create
// schema and referenced here for future direct-JSON validation paths.
void sceneAssetPlacementSchema;
void sceneAssetCollisionSchema;
void sceneAssetProvenanceSchema;
void DEFAULT_SCENE_ASSET_CATALOG;
