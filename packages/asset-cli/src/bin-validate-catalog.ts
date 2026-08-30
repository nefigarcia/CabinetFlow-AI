#!/usr/bin/env ts-node
import { DEFAULT_SCENE_ASSET_CATALOG } from "@woodcraft/shared";
import { validateCatalog } from "./catalog-validation";

// `pnpm asset:validate-catalog` — CI-friendly guard against catalog
// regressions. Runs the pure `validateCatalog` helper over
// `DEFAULT_SCENE_ASSET_CATALOG` and exits non-zero on any issue.
//
// This is safe to run without AWS access — no S3 calls.

function main(): void {
  const issues = validateCatalog(DEFAULT_SCENE_ASSET_CATALOG);
  if (issues.length === 0) {
    console.log(
      `[wc-asset validate-catalog] ✓ ${DEFAULT_SCENE_ASSET_CATALOG.length} definitions, no issues.`,
    );
    return;
  }
  console.error(
    `[wc-asset validate-catalog] ✗ ${issues.length} issue(s) in ${DEFAULT_SCENE_ASSET_CATALOG.length} definitions:`,
  );
  for (const i of issues) {
    console.error(`  ${i.definitionId} [${i.code}] ${i.message}`);
  }
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`[wc-asset validate-catalog] FAILED: ${(err as Error).message}`);
  process.exit(1);
}
