#!/usr/bin/env ts-node
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { SceneAssetCategory } from "@woodcraft/shared";
import { UsageError, parseUploadArgs, usage } from "./argv";
import { loadConfig } from "./config";
import { validateAndHashFile } from "./file-validation";
import { createS3Ops } from "./s3-client";
import { uploadSceneAsset } from "./uploader";
import { verifyUpload } from "./verify";

// CLI entrypoint for `pnpm asset:upload`. Kept small — all the
// interesting logic (validation, key generation, upload orchestration,
// post-upload verification) lives in dedicated modules and is
// unit-tested with mocks.

async function main(): Promise<void> {
  const args = parseUploadArgs(process.argv.slice(2));
  const config = loadConfig();

  console.log(
    `[wc-asset upload] Region=${config.region} · Bucket=${config.bucketName} · dry-run=${args.dryRun}`,
  );

  const model = await validateAndHashFile(args.model, {
    allowedExtensions: [".glb", ".gltf"],
    requireGlbHeader: args.model.toLowerCase().endsWith(".glb"),
  });
  console.log(
    `[wc-asset upload] Model  ${model.basename}  ${(model.sizeBytes / 1024).toFixed(0)} KB  sha256=${model.sha256.slice(0, 12)}…`,
  );

  const thumbnail = args.thumbnail
    ? await validateAndHashFile(args.thumbnail, {
        allowedExtensions: [".webp", ".png", ".jpg", ".jpeg"],
      })
    : undefined;
  if (thumbnail) {
    console.log(
      `[wc-asset upload] Thumb  ${thumbnail.basename}  ${(thumbnail.sizeBytes / 1024).toFixed(0)} KB  sha256=${thumbnail.sha256.slice(0, 12)}…`,
    );
  } else {
    console.log(
      `[wc-asset upload] No thumbnail supplied (primitive glyph fallback in catalog).`,
    );
  }

  const ops = args.dryRun ? null : createS3Ops(config.region);
  const put = ops ? ops.put : async () => {
    // no-op — the uploader still runs its key builder + manifest work.
  };

  const { manifest, warnings } = await uploadSceneAsset({
    category: args.category as SceneAssetCategory,
    id: args.id,
    version: args.version,
    bucket: config.bucketName,
    model,
    thumbnail,
    provenance: {
      sourceName: args.sourceName,
      sourceUrl: args.sourceUrl,
      license: args.license,
      author: args.author,
      acquiredAt: args.acquiredAt,
      notes: args.notes,
    },
    put,
  });

  console.log("");
  console.log("─── SUCCESS ────────────────────────────────────────────────");
  console.log(`  assetKey:     ${manifest.model.assetKey}`);
  if (manifest.thumbnail) {
    console.log(`  thumbnailKey: ${manifest.thumbnail.assetKey}`);
  }
  console.log("");
  console.log("Paste into a SceneAssetDefinition:");
  console.log("");
  console.log("  model: {");
  console.log('    format: "glb",');
  console.log(`    assetKey: "${manifest.model.assetKey}",`);
  if (manifest.thumbnail) {
    console.log(`    thumbnailKey: "${manifest.thumbnail.assetKey}",`);
  }
  console.log("  },");
  console.log("");
  for (const w of warnings) console.log(`[wc-asset upload] ${w}`);

  if (args.writeManifest) {
    const manifestPath = resolve(dirname(model.absolutePath), "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`[wc-asset upload] Manifest written: ${manifestPath}`);
  }

  if (args.dryRun) {
    console.log(`[wc-asset upload] Dry-run mode — no S3 PutObject was executed.`);
    return;
  }

  if (ops && !args.skipVerify) {
    console.log(`[wc-asset upload] Verifying uploaded objects…`);
    const report = await verifyUpload({
      bucket: config.bucketName,
      manifest,
      headObject: ops.headObject,
    });
    for (const c of report.checked) {
      console.log(`[wc-asset upload]   HeadObject ${c.key}  (${c.assetKey})`);
    }
    if (!report.ok) {
      console.error(`[wc-asset upload] ⚠ VERIFICATION ISSUES:`);
      for (const i of report.issues) console.error(`[wc-asset upload]   ${i.key}: ${i.message}`);
      process.exit(1);
    }
    console.log(`[wc-asset upload] ✓ Verified Content-Type, Cache-Control, size, and provenance metadata.`);
  }
}

main().catch((err: unknown) => {
  if (err instanceof UsageError) {
    console.error(`error: ${err.message}\n`);
    console.error(usage());
    process.exit(2);
  }
  console.error(`[wc-asset upload] FAILED: ${(err as Error).message}`);
  process.exit(1);
});
