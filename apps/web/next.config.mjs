import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo-root .env loader.
//
// Next.js only reads .env files from the app directory (`apps/web/`)
// by default. In this monorepo the authoritative .env lives at the
// repo root (matching the pattern the rest of the workspace uses:
// packages/db, packages/asset-cli, and apps/api all consume root
// .env). Without this bridge, browser-visible `NEXT_PUBLIC_*` vars
// defined at the root — including `NEXT_PUBLIC_SCENE_ASSET_BASE_URL`
// — would never reach the web bundle, and GLB URLs would fall back
// to `/assets/scene/...` (404 in dev).
//
// We only inject vars that are NOT already set in process.env, so
// per-app overrides (via `apps/web/.env.local`, Vercel project
// settings, or shell exports) always win.

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
    // Strip surrounding quotes if present; leave interior as-is.
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
  // Root .env is optional — a Vercel/production build may not have
  // one and instead relies on the platform's env settings.
  if (err.code !== "ENOENT") {
    console.warn(`[next.config] Failed to read root .env: ${err.message}`);
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@woodcraft/shared"],
  experimental: {
    optimizePackageImports: ["three", "@react-three/fiber", "@react-three/drei"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
