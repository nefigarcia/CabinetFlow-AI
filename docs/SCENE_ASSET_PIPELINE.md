# Scene Asset Pipeline

Reference for how 3D scene assets (GLB models + WebP thumbnails) flow
from an author's laptop into a customer's browser.

---

## 1 · Canonical key + URL contracts

Three DISTINCT concepts. Do not conflate.

| Concept | Shape | Where it lives |
|---|---|---|
| **Logical `assetKey`** | `<category>/<id>/<version>/<filename>` (no `scene/` prefix) | `SceneAssetDefinition.model.assetKey`, upload manifest, CLI stdout |
| **Physical S3 object key** | `scene/<assetKey>` | Passed to `PutObject.Key` by the upload CLI |
| **Public delivery URL** | `<base>/scene/<assetKey>` | Composed by `composeSceneAssetUrl(base, assetKey)` at render time |

Enforced by tests: `packages/shared/src/domain/sceneAssets/__tests__/asset-url.test.ts` — see the "Three-layer contract" describe block.

The `scene/` prefix appears **once**, in the storage layer and in the composer. It never appears inside a logical assetKey. `normalizeAssetKey` rejects logical keys that start with `scene/` at parse time, so the double-nesting bug (`scene/scene/…`, `/assets/scene/scene/…`) cannot recur.

### Local vs CDN

- `LOCAL_SCENE_ASSET_BASE = "/assets"` — bare parent of `scene/`. Files live at `apps/web/public/assets/scene/<category>/<id>/<version>/…`. Local URL: `/assets/scene/<assetKey>`.
- CDN base = root of the CDN (no `scene/` in the path). Example: `https://d123.cloudfront.net` or `https://assets.example.com`. CDN URL: `<base>/scene/<assetKey>`.

`NEXT_PUBLIC_SCENE_ASSET_BASE_URL` overrides the local base. Do NOT include `/scene` in the value — the composer adds it.

---

## 2 · Architecture

```
   author's laptop
         │
         │  pnpm asset:upload …
         ▼
     S3 bucket (private)                   woodcraft-os-files, us-east-1
         │  physical key: scene/<category>/<id>/<version>/{model.glb,thumbnail.webp}
         ▼
     CloudFront distribution               (target production layout)
         │  Origin Access Control → S3 (bucket policy allows OAC only)
         ▼
     browser
         │  NEXT_PUBLIC_SCENE_ASSET_BASE_URL = https://<distribution-domain>
         │  composeSceneAssetUrl(base, assetKey) → <base>/scene/<assetKey>
         ▼
     useGLTF cache + SceneAssetLoader      (drei, cached + cloned per instance)
         │
         ▼
     R3F scene graph
```

Failure modes remain graceful:
- CDN 404 → `SceneAssetErrorBoundary` → primitive fallback renderer.
- Broken thumbnail → `<img onError>` hides → category glyph.
- Missing model on a definition → primitive fallback (no HTTP attempt).

The browser NEVER touches AWS. It only reads `NEXT_PUBLIC_SCENE_ASSET_BASE_URL` and issues normal HTTPS GETs.

---

## 3 · S3 physical key layout

```
scene/
├── appliance/
│   ├── refrigerator-01/
│   │   ├── v1/
│   │   │   ├── model.glb
│   │   │   └── thumbnail.webp
│   │   └── v2/…
│   └── range-01/v1/…
├── furniture/
├── plumbing/
├── lighting/
├── decor/
├── plant/
├── rug/
├── electronics/
└── fixture/
```

Rules:
- `scene/` — top-level prefix. Reserved for the curated product catalog.
- `<category>` — matches `SceneAssetCategory` from `@woodcraft/shared`.
- `<id>` — kebab-case, `[a-z0-9][a-z0-9_-]*`.
- `<version>` — `v1`, `v2`… or content-hash tokens.
- **Never overwrite in place.** Bump the version.

Definitions store the LOGICAL key:

```ts
model: {
  format: "glb",
  assetKey: "appliance/refrigerator-01/v1/model.glb",       // logical
  thumbnailKey: "appliance/refrigerator-01/v1/thumbnail.webp",
}
```

---

## 4 · CloudFront + OAC (target production architecture)

Preferred over public S3 objects. Browser talks to CloudFront; CloudFront talks to a private S3 bucket via Origin Access Control (OAC).

### AWS Console steps (one-time)

**S3 bucket (existing `woodcraft-os-files`):**
1. **Object Ownership:** Bucket owner enforced. ACLs disabled.
2. **Block Public Access:** all four toggles ON (fully private).
3. **CORS:** none needed for CloudFront delivery. Add CORS only if you also want direct-S3 URLs to work from the browser during debugging.

**CloudFront distribution:**
1. Create a new distribution.
2. Origin domain: `woodcraft-os-files.s3.us-east-1.amazonaws.com` (S3 REST endpoint, NOT the website endpoint).
3. Origin access: **Origin access control settings (recommended)**.
   - Create a new OAC (defaults are fine — sign with SigV4, always).
4. Default cache behavior:
   - Viewer protocol policy: **Redirect HTTP to HTTPS**.
   - Allowed HTTP methods: **GET, HEAD**.
   - Cache policy: **CachingOptimized** (uses long TTLs; safe because our keys are immutable).
   - Origin request policy: **none** (we don't forward any headers/cookies).
   - Response headers policy: **CORS-With-Preflight** if you want browsers on any origin, or a custom policy allowing only your web origins.
   - Compress objects automatically: **on** (helps thumbnails; GLB is already binary).
5. Price class: whatever fits your reach. `PriceClass_100` is fine to start.
6. Web ACL (WAF): optional. Not required for public catalog delivery.
7. Save. CloudFront prints the exact bucket policy JSON to paste into S3 (see next step).

**S3 bucket policy** (allow only the OAC to GET `scene/*`):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::woodcraft-os-files/scene/*",
    "Condition": {
      "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>" }
    }
  }]
}
```

CloudFront's console gives you this policy pre-filled — just paste it.

**Cache behavior:**
- Keys are immutable + versioned → CloudFront can cache aggressively.
- Do NOT enable "smooth streaming" or "field-level encryption".
- Signed viewer URLs are **not** needed for the public catalog. Reserved for a future customer/private-asset pipeline (§13 below).

### After CloudFront exists

Set in Vercel (Preview + Production):
```
NEXT_PUBLIC_SCENE_ASSET_BASE_URL = https://<distribution-domain>
```

No code change. The application resolver is provider-neutral — it just prepends `scene/` to any base URL it's given.

### Direct-S3 URL as a temporary fallback

Until CloudFront + OAC exist, you can point `NEXT_PUBLIC_SCENE_ASSET_BASE_URL` at the S3 REST endpoint (`https://woodcraft-os-files.s3.us-east-1.amazonaws.com`) if the bucket is configured for public GETs on `scene/*`. This mode is documented but NOT recommended long-term — CloudFront + OAC keeps the bucket private.

---

## 5 · Environment variables

| Variable | Where read | Purpose |
|---|---|---|
| `AWS_REGION` | server / CLI | S3 API region |
| `AWS_ACCESS_KEY_ID` | server / CLI | IAM access key (never public) |
| `AWS_SECRET_ACCESS_KEY` | server / CLI | IAM secret (never public) |
| `S3_BUCKET_NAME` | server / CLI | Target bucket for PutObject |
| `NEXT_PUBLIC_SCENE_ASSET_BASE_URL` | browser (Next inlines at build) | CDN/CloudFront root; local fallback when empty |

**Never** create a `NEXT_PUBLIC_AWS_*` variable — that would ship credentials to every browser.

**Credential rotation:** any AWS keys currently in `.env` should be considered due for rotation. The CLI uses the standard AWS SDK credential provider chain, so rotating means: replace the values in `.env` (and in Vercel / GitHub Actions secrets), then run `pnpm asset:check` to confirm the new keys work. No code change.

---

## 6 · CLI commands

Located at `packages/asset-cli`. Three subcommands.

### `pnpm asset:check`
Read-only. Verifies:
- Credentials resolve via SDK default provider chain.
- `HeadBucket` succeeds (region + auth OK).
- `ListObjectsV2` with prefix `scene/` and `MaxKeys=1` succeeds (upload role has the necessary permissions).

No uploads, no writes. Never prints secrets.

### `pnpm asset:validate-catalog`
Pure validation over `DEFAULT_SCENE_ASSET_CATALOG`. Fails when any of:
- Modeled definition lacks `provenance`.
- `model.assetKey` is malformed (wrong shape, contains `scene/`, path traversal, absolute URL).
- Top-level `thumbnailKey` or `model.thumbnailKey` malformed.
- Duplicate `id` across the catalog.
- Unsupported `model.format` (only `glb` + `gltf` today).

Safe to run in CI without AWS.

### `pnpm asset:upload`
Uploads model + optional thumbnail. Steps performed:
1. Validates every file (extension, size, GLB magic-header where practical, path-traversal defense).
2. Computes SHA-256 of each file.
3. Composes the canonical LOGICAL assetKey; passes the PHYSICAL S3 key (`scene/<assetKey>`) to PutObject.
4. `PutObject` with correct `Content-Type` + `Cache-Control: public, max-age=31536000, immutable`. **No ACL** — the bucket runs Object Ownership = Bucket owner enforced.
5. Copies provenance into S3 object metadata (`x-amz-meta-source-name`, `x-amz-meta-license`, etc.).
6. **Post-upload verification (`HeadObject`)** — asserts Content-Type, Cache-Control, Content-Length, and metadata match the manifest. Fails the CLI if any drift.
7. Writes `manifest.json` next to the source file (unless `--no-manifest`).
8. Prints the exact `model: { … }` block to paste into a definition.

Flags:
- `--dry-run` → skip PutObject + HeadObject; still validates + prints keys.
- `--no-manifest` → skip writing the sidecar.
- `--skip-verify` → skip the HeadObject verification pass (not recommended).

Example:
```
pnpm asset:upload -- \
  --category appliance \
  --id refrigerator-01 \
  --version v1 \
  --model ./staging/refrigerator/model.glb \
  --thumbnail ./staging/refrigerator/thumbnail.webp \
  --license CC0-1.0 \
  --source-name "Poly Haven" \
  --source-url https://polyhaven.com/a/refrigerator \
  --author "Poly Haven"
```

Environment: reads `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`. Load from the root `.env` via `dotenv-cli` or an `export` before running.

---

## 7 · Licensing & provenance

Every modeled definition MUST carry `provenance`. Enforced by:
- Runtime: `findModeledDefinitionsMissingProvenance(catalog)` (shared).
- CI: `pnpm asset:validate-catalog`.

Fields:
```ts
provenance: {
  sourceName: "Poly Haven",         // required
  sourceUrl: "https://…",           // optional but recommended
  license: "CC0-1.0",               // required — SPDX id or plain string
  author: "Author Name",            // optional
  acquiredAt: "2026-08-29",         // optional ISO date
  notes: "decimated to 25k tris",   // optional
}
```

Do NOT scrape commercial product models. Use only assets with clear rights (CC0 preferred; CC-BY acceptable with attribution).

---

## 8 · Adding a new catalog asset

1. Acquire a legally-usable GLB + WebP thumbnail. Record source URL + license.
2. Optionally decimate / optimize with a Node-friendly tool (glTF-Transform).
3. Run `pnpm asset:check` once to confirm S3 connectivity.
4. Run the upload CLI (see §6). Copy the printed `model: { … }` block.
5. Edit `packages/shared/src/domain/sceneAssets/default-catalog.ts`:
   - **Update the existing entry's `model` field.** Do NOT create a duplicate — the primitive remains the fallback.
   - Add `provenance: {...}`.
6. `pnpm --filter @woodcraft/asset-cli asset:validate-catalog`.
7. `pnpm --filter @woodcraft/shared vitest run` + `pnpm --filter @woodcraft/web build`.

---

## 9 · Real-size normalization

`SceneAssetDefinition.dimensionsMm` is authoritative. The existing normalization system fits the raw GLB into those dimensions and anchors it bottom-center. Do NOT modify `dimensionsMm` based on the mesh bounding box.

When you first render a real asset, check:
- Upright orientation (Y = up).
- Front direction (asset faces +Z in its local frame → wall-mounted resolver aligns it into the room correctly).
- Floor contact (bottom at Y = 0).
- Centered X/Z anchor.
- No unexpected 90° rotations (e.g. axis mismatch from Blender export).

Only if a specific model needs correction, use `model.normalization`:
```ts
model: {
  format: "glb",
  assetKey: "…",
  normalization: {
    scale: 1.02,                    // slight fit correction
    rotationDeg: { x: 0, y: 90, z: 0 },
    offsetMm: { x: 0, y: 0, z: 0 },
  },
}
```

---

## 10 · Thumbnails

Prefer WebP. Use a neutral catalog preview render — never manufacturer marketing imagery. Missing / broken thumbnail falls back to the category glyph (existing behavior). Thumbnail delivery uses the same CDN + resolver.

---

## 11 · IAM (least privilege)

Grant the upload role/user these permissions, scoped to
`arn:aws:s3:::woodcraft-os-files/scene/*`. **`s3:PutObjectAcl` is NOT required** — the bucket has Object Ownership = Bucket owner enforced, and the uploader does not set an ACL.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::woodcraft-os-files/scene/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::woodcraft-os-files",
      "Condition": { "StringLike": { "s3:prefix": ["scene/*"] } }
    }
  ]
}
```

Public GETs happen through CloudFront + OAC, NOT through this role.

---

## 12 · Testing

`packages/asset-cli` — 38 tests, all with mocked S3 (no AWS needed):
```
cd packages/asset-cli && npx vitest run
```

`packages/shared` — the URL resolver + key generator + manifest schema + catalog validator are covered by the shared vitest suite. Includes explicit tests that local/S3-storage/CDN paths all map to the same logical asset.
```
cd packages/shared && npx vitest run
```

Neither requires AWS.

---

## 13 · Custom / customer assets (future — NOT this pipeline)

The `scene/` prefix is reserved for the CURATED PRODUCT CATALOG. Future customer-uploaded assets (organization-private files, per-project uploads) must be a separate design:

- Different S3 prefix (e.g. `org/<orgId>/…`).
- Signed viewer URLs for private access.
- Distinct IAM boundary.
- Possibly a dedicated bucket for isolation.

Do NOT mix customer uploads into the catalog pipeline.

---

## 14 · Local development

Zero AWS setup required.
- Leave `NEXT_PUBLIC_SCENE_ASSET_BASE_URL` empty.
- Drop files at `apps/web/public/assets/scene/<category>/<id>/<version>/…`.
- Directory shape matches S3 exactly — the assetKey is unchanged local ↔ prod.
