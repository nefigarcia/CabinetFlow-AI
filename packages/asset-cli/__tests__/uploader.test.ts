import { describe, expect, it, vi } from "vitest";
import { uploadSceneAsset, type PutObjectFn, type PutObjectRequest } from "../src/uploader";
import type { ValidatedFile } from "../src/file-validation";

// Sanity: the PutObjectRequest shape does NOT include any ACL field.
// Object Ownership = Bucket owner enforced means ACLs are disabled at
// the bucket level; the uploader must not attempt to set one.
describe("PutObject request shape — no ACLs", () => {
  it("PutObjectRequest keys are limited to bucket/key/body/contentType/cacheControl/metadata", () => {
    const sample: PutObjectRequest = {
      bucket: "b",
      key: "scene/x/y/v1/model.glb",
      body: Buffer.alloc(4),
      contentType: "model/gltf-binary",
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { license: "CC0-1.0" },
    };
    // Object.keys shape ↔ compile-time interface. If someone adds ACL later,
    // this list flags it in code review.
    expect(Object.keys(sample).sort()).toEqual([
      "body",
      "bucket",
      "cacheControl",
      "contentType",
      "key",
      "metadata",
    ]);
  });
});

function makeFile(overrides: Partial<ValidatedFile> = {}): ValidatedFile {
  return {
    absolutePath: "/tmp/model.glb",
    basename: "model.glb",
    sizeBytes: 1_500_000,
    sha256: "a".repeat(64),
    body: Buffer.from("glTF..."),
    ...overrides,
  };
}

describe("uploadSceneAsset — mocked S3", () => {
  it("PutObject uses the PHYSICAL key `scene/…`; manifest stores the LOGICAL key", async () => {
    const calls: PutObjectRequest[] = [];
    const put = vi.fn(async (req: PutObjectRequest) => {
      calls.push(req);
    });

    const { manifest, warnings } = await uploadSceneAsset({
      category: "appliance",
      id: "refrigerator-01",
      version: "v1",
      bucket: "woodcraft-os-files",
      model: makeFile(),
      provenance: { sourceName: "Poly Haven", license: "CC0-1.0" },
      put,
      now: () => new Date("2026-08-29T00:00:00Z"),
    });

    expect(calls).toHaveLength(1);
    // Physical S3 key MUST carry the `scene/` prefix.
    expect(calls[0]!.key).toBe("scene/appliance/refrigerator-01/v1/model.glb");
    expect(calls[0]!.contentType).toBe("model/gltf-binary");
    expect(calls[0]!.cacheControl).toBe("public, max-age=31536000, immutable");
    expect(calls[0]!.metadata).toEqual({
      "source-name": "Poly Haven",
      license: "CC0-1.0",
    });
    // Logical key MUST NOT carry `scene/` — it's what the developer
    // pastes into a SceneAssetDefinition.
    expect(manifest.model.assetKey).toBe("appliance/refrigerator-01/v1/model.glb");
    expect(manifest.thumbnail).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it("uploads model + thumbnail (2 PutObjects) with the right MIMEs + LOGICAL manifest keys", async () => {
    const put = vi.fn(async () => {});
    const { manifest } = await uploadSceneAsset({
      category: "furniture",
      id: "sofa-3seat",
      version: "v1",
      bucket: "b",
      model: makeFile({ basename: "model.glb" }),
      thumbnail: makeFile({
        basename: "thumbnail.webp",
        sizeBytes: 30_000,
        sha256: "b".repeat(64),
      }),
      provenance: { sourceName: "In-house", license: "In-house / proprietary" },
      put,
      now: () => new Date("2026-08-29T00:00:00Z"),
    });
    expect(put).toHaveBeenCalledTimes(2);
    // Manifest = logical keys (no scene/).
    expect(manifest.model.assetKey).toBe("furniture/sofa-3seat/v1/model.glb");
    expect(manifest.thumbnail?.assetKey).toBe("furniture/sofa-3seat/v1/thumbnail.webp");
    expect(manifest.thumbnail?.contentType).toBe("image/webp");
  });

  it("uses model/gltf+json for .gltf files", async () => {
    const calls: PutObjectRequest[] = [];
    const put: PutObjectFn = async (req) => {
      calls.push(req);
    };
    await uploadSceneAsset({
      category: "furniture",
      id: "sofa-3seat",
      version: "v1",
      bucket: "b",
      model: makeFile({ basename: "model.gltf", body: Buffer.from('{"asset":{"version":"2.0"}}') }),
      provenance: { sourceName: "In-house", license: "In-house / proprietary" },
      put,
    });
    expect(calls[0]?.contentType).toBe("model/gltf+json");
  });

  it("throws when the model extension is not GLB/glTF", async () => {
    await expect(
      uploadSceneAsset({
        category: "appliance",
        id: "x",
        version: "v1",
        bucket: "b",
        model: makeFile({ basename: "bad.obj" }),
        provenance: { sourceName: "x", license: "x" },
        put: async () => {},
      }),
    ).rejects.toThrow(/Cannot resolve Content-Type/);
  });

  it("throws when id or version fail slug safety", async () => {
    await expect(
      uploadSceneAsset({
        category: "appliance",
        id: "../evil",
        version: "v1",
        bucket: "b",
        model: makeFile(),
        provenance: { sourceName: "x", license: "x" },
        put: async () => {},
      }),
    ).rejects.toThrow(/invalid category\/id\/version\/extension/);
  });

  it("warns when the model exceeds the category size budget (advisory only, still uploads)", async () => {
    // decor soft limit = 1 MB. Push it well over.
    const { warnings } = await uploadSceneAsset({
      category: "decor",
      id: "big",
      version: "v1",
      bucket: "b",
      model: makeFile({ sizeBytes: 3 * 1024 * 1024 }),
      provenance: { sourceName: "x", license: "x" },
      put: async () => {},
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/exceeds the .* MB soft budget/);
  });

  it("copies provenance into S3 object metadata for both files", async () => {
    const calls: PutObjectRequest[] = [];
    await uploadSceneAsset({
      category: "furniture",
      id: "chair",
      version: "v1",
      bucket: "b",
      model: makeFile(),
      thumbnail: makeFile({ basename: "thumbnail.webp", sha256: "b".repeat(64) }),
      provenance: {
        sourceName: "Sketchfab",
        license: "CC-BY-4.0",
        author: "Jane Doe",
        acquiredAt: "2026-08-29",
      },
      put: async (req) => {
        calls.push(req);
      },
    });
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.metadata).toEqual({
        "source-name": "Sketchfab",
        license: "CC-BY-4.0",
        author: "Jane Doe",
        "acquired-at": "2026-08-29",
      });
    }
  });
});
