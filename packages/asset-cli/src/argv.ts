import { SCENE_ASSET_CATEGORIES } from "@woodcraft/shared";

// Tiny hand-rolled argv parser. Avoids adding a dependency (yargs / commander)
// for a CLI with a fixed, small surface. Supports:
//   --key value
//   --key=value
//   --flag                (boolean toggles — not used today but kept simple)

export interface UploadArgs {
  category: string;
  id: string;
  version: string;
  model: string;
  thumbnail?: string;
  license: string;
  sourceName: string;
  sourceUrl?: string;
  author?: string;
  acquiredAt?: string;
  notes?: string;
  /** When true, print the intended plan + skip the S3 PutObject call. */
  dryRun: boolean;
  /** When true, write the manifest to `<model dir>/manifest.json`. */
  writeManifest: boolean;
  /** When true, skip the post-upload HeadObject verification pass. */
  skipVerify: boolean;
}

export function parseUploadArgs(argv: readonly string[]): UploadArgs {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq >= 0) {
      map.set(token.slice(2, eq), token.slice(eq + 1));
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith("--")) {
      map.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }

  const required = ["category", "id", "version", "model", "license", "source-name"] as const;
  const missing = required.filter((k) => !map.has(k) || (map.get(k) ?? "").trim().length === 0);
  if (missing.length > 0) {
    throw new UsageError(
      `Missing required argument(s): ${missing.map((k) => `--${k}`).join(", ")}`,
    );
  }

  const category = map.get("category")!.trim();
  if (!(SCENE_ASSET_CATEGORIES as readonly string[]).includes(category)) {
    throw new UsageError(
      `Unknown --category "${category}". Valid: ${SCENE_ASSET_CATEGORIES.join(", ")}`,
    );
  }

  return {
    category,
    id: map.get("id")!.trim(),
    version: (map.get("version") ?? "").trim(),
    model: map.get("model")!.trim(),
    thumbnail: map.get("thumbnail")?.trim() || undefined,
    license: map.get("license")!.trim(),
    sourceName: map.get("source-name")!.trim(),
    sourceUrl: map.get("source-url")?.trim() || undefined,
    author: map.get("author")?.trim() || undefined,
    acquiredAt: map.get("acquired-at")?.trim() || undefined,
    notes: map.get("notes")?.trim() || undefined,
    dryRun: flags.has("dry-run") || map.get("dry-run") === "true",
    writeManifest: !(flags.has("no-manifest") || map.get("no-manifest") === "true"),
    skipVerify: flags.has("skip-verify") || map.get("skip-verify") === "true",
  };
}

export class UsageError extends Error {}

export function usage(): string {
  return `wc-asset upload — upload a Scene Asset model + thumbnail to S3.

USAGE:
  pnpm --filter @woodcraft/asset-cli asset:upload -- \\
    --category <appliance|furniture|plumbing|lighting|decor|plant|rug|electronics|fixture> \\
    --id <kebab-case-id> \\
    --version <v1|v2|...|<content-hash>> \\
    --model <path/to/model.glb> \\
    --thumbnail <path/to/thumbnail.webp> \\
    --license <SPDX or plain string> \\
    --source-name <human-readable source> \\
    [--source-url <https://...>] \\
    [--author <name>] \\
    [--acquired-at <YYYY-MM-DD>] \\
    [--notes <free text>] \\
    [--dry-run] \\
    [--no-manifest]

ENVIRONMENT:
  AWS_REGION            AWS region (e.g. us-east-1)
  S3_BUCKET_NAME        Target bucket name (e.g. woodcraft-os-files)
  AWS_ACCESS_KEY_ID     IAM access key with s3:PutObject on scene/*
  AWS_SECRET_ACCESS_KEY IAM secret

OUTPUT:
  On success, prints the assetKey + thumbnailKey (opaque; paste into
  a SceneAssetDefinition.model.assetKey / thumbnailKey field). When
  --no-manifest is not set, writes an audit-trail manifest.json next to
  the model file.
`;
}
