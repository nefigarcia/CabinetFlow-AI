#!/usr/bin/env ts-node
import { SCENE_ASSET_PREFIX } from "@woodcraft/shared";
import { loadConfig } from "./config";
import { createS3Ops } from "./s3-client";

// `pnpm asset:check` — read-only S3 connectivity + prefix reachability
// check. Never uploads anything. Never prints secrets.
//
// What it verifies:
//   · AWS credentials resolve via the SDK's default provider chain.
//   · The configured bucket exists and is reachable in the configured
//     region (HeadBucket).
//   · The `scene/` prefix is listable — a fast smoke test that our
//     upload role has ListBucket (or that the bucket allows anonymous
//     listing).

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(`[wc-asset check] Region=${config.region} · Bucket=${config.bucketName}`);

  const ops = createS3Ops(config.region);

  // HeadBucket — validates credentials + region.
  try {
    await ops.headBucket(config.bucketName);
    console.log(`[wc-asset check] ✓ HeadBucket succeeded (credentials + region OK).`);
  } catch (err) {
    console.error(
      `[wc-asset check] ✗ HeadBucket failed: ${(err as Error).message}\n` +
        `  → Verify AWS_REGION matches the bucket's region and that the credentials\n` +
        `    have at least s3:ListBucket on ${config.bucketName}.`,
    );
    process.exit(1);
  }

  // ListObjectsV2 with MaxKeys=1 and Prefix=scene/ — validates the
  // upload prefix is reachable. An empty result is fine (fresh bucket).
  try {
    const list = await ops.listObjectsV2(
      config.bucketName,
      `${SCENE_ASSET_PREFIX}/`,
      1,
    );
    console.log(
      `[wc-asset check] ✓ ListObjectsV2 succeeded — ${list.keys.length === 0 ? "prefix is empty" : `first key: ${list.keys[0]}`}.`,
    );
  } catch (err) {
    console.error(
      `[wc-asset check] ✗ ListObjectsV2 failed: ${(err as Error).message}\n` +
        `  → Grant s3:ListBucket on ${config.bucketName} with a Condition on prefix "${SCENE_ASSET_PREFIX}/*".`,
    );
    process.exit(1);
  }

  console.log(`[wc-asset check] Ready to upload.`);
}

main().catch((err: unknown) => {
  console.error(`[wc-asset check] FAILED: ${(err as Error).message}`);
  process.exit(1);
});
