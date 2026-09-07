import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo-root .env loader.
//
// Next.js only reads .env files from the app directory (`apps/api/`)
// by default, so server-only variables defined only at the repo root
// (SCENE_ASSET_PLATFORM_ADMIN_EMAILS, ASSET_S3_*, etc.) would never
// reach the API bundle. We mirror the loader `apps/web/next.config.mjs`
// uses so both Next apps in the workspace read from the same root file.
//
// Vars already set in process.env win (per-app `.env.local`, Vercel
// project settings, or shell exports override the root value).

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = resolve(__dirname, "../../.env");

try {
  const raw = readFileSync(ROOT_ENV, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch (err) {
  if (err.code !== "ENOENT") {
    console.warn(`[next.config] Failed to read root .env: ${err.message}`);
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@woodcraft/shared", "@woodcraft/db"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
