import { describe, expect, it } from "vitest";
import type { AssetUploadManifest } from "@woodcraft/shared";
import { verifyUpload } from "../src/verify";
import type { HeadObjectResult } from "../src/s3-client";

function sample(): AssetUploadManifest {
  return {
    id: "refrigerator-01",
    category: "appliance",
    version: "v1",
    model: {
      assetKey: "appliance/refrigerator-01/v1/model.glb",
      sizeBytes: 2_500_000,
      sha256: "a".repeat(64),
      contentType: "model/gltf-binary",
    },
    thumbnail: {
      assetKey: "appliance/refrigerator-01/v1/thumbnail.webp",
      sizeBytes: 40_000,
      sha256: "b".repeat(64),
      contentType: "image/webp",
    },
    provenance: { sourceName: "Poly Haven", license: "CC0-1.0" },
    uploadedAt: "2026-08-29T00:00:00.000Z",
  };
}

function makeHead(overrides: Partial<HeadObjectResult> = {}): HeadObjectResult {
  return {
    contentType: "model/gltf-binary",
    contentLength: 2_500_000,
    cacheControl: "public, max-age=31536000, immutable",
    metadata: { "source-name": "Poly Haven", license: "CC0-1.0" },
    ...overrides,
  };
}

describe("verifyUpload", () => {
  it("returns ok=true when every field matches the manifest", async () => {
    const heads = new Map<string, HeadObjectResult>([
      ["scene/appliance/refrigerator-01/v1/model.glb", makeHead()],
      [
        "scene/appliance/refrigerator-01/v1/thumbnail.webp",
        makeHead({ contentType: "image/webp", contentLength: 40_000 }),
      ],
    ]);
    const report = await verifyUpload({
      bucket: "b",
      manifest: sample(),
      headObject: async (_bucket, key) => heads.get(key)!,
    });
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.checked.map((c) => c.key)).toEqual([
      "scene/appliance/refrigerator-01/v1/model.glb",
      "scene/appliance/refrigerator-01/v1/thumbnail.webp",
    ]);
  });

  it("HeadObject is called with the PHYSICAL S3 key (with scene/ prefix)", async () => {
    const calls: string[] = [];
    await verifyUpload({
      bucket: "b",
      manifest: sample(),
      headObject: async (_bucket, key) => {
        calls.push(key);
        return makeHead(
          key.endsWith(".webp")
            ? { contentType: "image/webp", contentLength: 40_000 }
            : {},
        );
      },
    });
    expect(calls).toEqual([
      "scene/appliance/refrigerator-01/v1/model.glb",
      "scene/appliance/refrigerator-01/v1/thumbnail.webp",
    ]);
  });

  it("flags Content-Type drift", async () => {
    const report = await verifyUpload({
      bucket: "b",
      manifest: { ...sample(), thumbnail: undefined },
      headObject: async () => makeHead({ contentType: "application/octet-stream" }),
    });
    expect(report.ok).toBe(false);
    expect(report.issues[0]!.message).toMatch(/Content-Type mismatch/);
  });

  it("flags Cache-Control drift", async () => {
    const report = await verifyUpload({
      bucket: "b",
      manifest: { ...sample(), thumbnail: undefined },
      headObject: async () => makeHead({ cacheControl: "no-store" }),
    });
    expect(report.ok).toBe(false);
    expect(report.issues[0]!.message).toMatch(/Cache-Control mismatch/);
  });

  it("flags Content-Length drift", async () => {
    const report = await verifyUpload({
      bucket: "b",
      manifest: { ...sample(), thumbnail: undefined },
      headObject: async () => makeHead({ contentLength: 999 }),
    });
    expect(report.ok).toBe(false);
    expect(report.issues[0]!.message).toMatch(/Content-Length mismatch/);
  });

  it("flags missing provenance metadata", async () => {
    const report = await verifyUpload({
      bucket: "b",
      manifest: { ...sample(), thumbnail: undefined },
      headObject: async () => makeHead({ metadata: {} }),
    });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => /source-name/.test(i.message))).toBe(true);
    expect(report.issues.some((i) => /license/.test(i.message))).toBe(true);
  });

  it("catches upstream errors (bucket denied / object missing) as issues", async () => {
    const report = await verifyUpload({
      bucket: "b",
      manifest: { ...sample(), thumbnail: undefined },
      headObject: async () => {
        throw new Error("NoSuchKey");
      },
    });
    expect(report.ok).toBe(false);
    expect(report.issues[0]!.message).toMatch(/HeadObject failed/);
  });
});
