import {
  SCENE_ASSET_PREFIX,
  findModeledDefinitionsMissingProvenance,
  normalizeAssetKey,
  type SceneAssetDefinition,
} from "@woodcraft/shared";

// Pure catalog validation — usable from a CLI + from CI.
//
// Rules enforced:
//   · Every modeled definition MUST carry provenance.
//   · `model.assetKey` must be a valid LOGICAL key
//     (see normalizeAssetKey — no `scene/` prefix, no traversal, no
//     absolute URLs).
//   · If `model.thumbnailKey` is present, same rules.
//   · If `thumbnailKey` (top-level) is present, same rules.
//   · Definition ids must be unique across the catalog.
//   · `model.format` must be a supported format we can serve today.

export interface CatalogIssue {
  definitionId: string;
  code:
    | "MISSING_PROVENANCE"
    | "MALFORMED_ASSET_KEY"
    | "MALFORMED_THUMBNAIL_KEY"
    | "DUPLICATE_ID"
    | "UNSUPPORTED_MODEL_FORMAT";
  message: string;
}

const SUPPORTED_FORMATS = new Set<string>(["glb", "gltf"]);

export function validateCatalog(
  definitions: readonly SceneAssetDefinition[],
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];

  // Provenance — reuse the shared helper.
  for (const id of findModeledDefinitionsMissingProvenance(definitions)) {
    issues.push({
      definitionId: id,
      code: "MISSING_PROVENANCE",
      message: `Modeled definition "${id}" is missing \`provenance\`. Every model MUST carry source + license.`,
    });
  }

  // Asset key / thumbnail key well-formedness + inline scene/ prefix check.
  for (const d of definitions) {
    if (d.model) {
      const normalized = normalizeAssetKey(d.model.assetKey);
      if (!normalized) {
        issues.push({
          definitionId: d.id,
          code: "MALFORMED_ASSET_KEY",
          message: `Definition "${d.id}" has an invalid \`model.assetKey\` — must be a logical key of the shape "<category>/<id>/<version>/<file>" without a "${SCENE_ASSET_PREFIX}/" prefix.`,
        });
      }
      if (d.model.thumbnailKey !== undefined) {
        const t = normalizeAssetKey(d.model.thumbnailKey);
        if (!t) {
          issues.push({
            definitionId: d.id,
            code: "MALFORMED_THUMBNAIL_KEY",
            message: `Definition "${d.id}" has an invalid \`model.thumbnailKey\`.`,
          });
        }
      }
      if (!SUPPORTED_FORMATS.has(d.model.format)) {
        issues.push({
          definitionId: d.id,
          code: "UNSUPPORTED_MODEL_FORMAT",
          message: `Definition "${d.id}" declares \`model.format = "${d.model.format}"\` — supported: ${[...SUPPORTED_FORMATS].join(", ")}.`,
        });
      }
    }
    if (d.thumbnailKey !== undefined) {
      const t = normalizeAssetKey(d.thumbnailKey);
      if (!t) {
        issues.push({
          definitionId: d.id,
          code: "MALFORMED_THUMBNAIL_KEY",
          message: `Definition "${d.id}" has an invalid top-level \`thumbnailKey\`.`,
        });
      }
    }
  }

  // Duplicate ids.
  const seen = new Set<string>();
  for (const d of definitions) {
    if (seen.has(d.id)) {
      issues.push({
        definitionId: d.id,
        code: "DUPLICATE_ID",
        message: `Duplicate definition id "${d.id}" — every catalog entry must be unique.`,
      });
    } else {
      seen.add(d.id);
    }
  }

  return issues;
}
