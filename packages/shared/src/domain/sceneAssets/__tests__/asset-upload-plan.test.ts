import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_CACHE_CONTROL,
  assetUploadManifestSchema,
  buildSceneAssetKey,
  fileSizeAdvice,
  pickModelContentType,
  pickThumbnailContentType,
  validateUploadKeyInput,
} from "../asset-upload-plan";

describe("MIME resolution", () => {
  it("selects the right Content-Type for GLB / glTF", () => {
    expect(pickModelContentType("model.glb")).toBe("model/gltf-binary");
    expect(pickModelContentType("model.GLB")).toBe("model/gltf-binary");
    expect(pickModelContentType("scene.gltf")).toBe("model/gltf+json");
    expect(pickModelContentType("bad.obj")).toBeNull();
    expect(pickModelContentType("no-ext")).toBeNull();
  });

  it("selects the right Content-Type for common thumbnail formats", () => {
    expect(pickThumbnailContentType("thumb.webp")).toBe("image/webp");
    expect(pickThumbnailContentType("thumb.PNG")).toBe("image/png");
    expect(pickThumbnailContentType("thumb.jpg")).toBe("image/jpeg");
    expect(pickThumbnailContentType("thumb.jpeg")).toBe("image/jpeg");
    expect(pickThumbnailContentType("thumb.gif")).toBeNull();
  });
});

describe("buildSceneAssetKey — canonical LOGICAL layout", () => {
  it("produces `<category>/<id>/<version>/<filename>` WITHOUT the `scene/` prefix", () => {
    expect(
      buildSceneAssetKey({
        category: "appliance",
        id: "refrigerator-01",
        version: "v1",
        kind: "model",
        extension: ".glb",
      }),
    ).toBe("appliance/refrigerator-01/v1/model.glb");
    expect(
      buildSceneAssetKey({
        category: "appliance",
        id: "refrigerator-01",
        version: "v1",
        kind: "thumbnail",
        extension: ".webp",
      }),
    ).toBe("appliance/refrigerator-01/v1/thumbnail.webp");
  });

  it("lowercases the extension", () => {
    expect(
      buildSceneAssetKey({
        category: "furniture",
        id: "sofa-3seat",
        version: "v2",
        kind: "model",
        extension: ".GLB",
      }),
    ).toBe("furniture/sofa-3seat/v2/model.glb");
  });

  it("returns null on unsafe id / version / extension", () => {
    expect(
      buildSceneAssetKey({
        category: "appliance",
        id: "../secret",
        version: "v1",
        kind: "model",
        extension: ".glb",
      }),
    ).toBeNull();
    expect(
      buildSceneAssetKey({
        category: "appliance",
        id: "fridge",
        version: "v1/../",
        kind: "model",
        extension: ".glb",
      }),
    ).toBeNull();
    expect(
      buildSceneAssetKey({
        category: "appliance",
        id: "fridge",
        version: "v1",
        kind: "model",
        extension: ".obj",
      }),
    ).toBeNull();
  });

  it("supports content-hash-style versions (e.g. `abc123`)", () => {
    expect(
      buildSceneAssetKey({
        category: "furniture",
        id: "chair",
        version: "abc12345",
        kind: "model",
        extension: ".glb",
      }),
    ).toBe("furniture/chair/abc12345/model.glb");
  });
});

describe("validateUploadKeyInput", () => {
  it("rejects unknown categories", () => {
    expect(
      validateUploadKeyInput({
        category: "not-a-category" as unknown as "appliance",
        id: "x",
        version: "v1",
        kind: "model",
        extension: ".glb",
      }),
    ).toBe(false);
  });

  it("rejects ids with uppercase / spaces / slashes", () => {
    for (const bad of ["Refrigerator-01", "with space", "a/b", "a\\b", "..evil"]) {
      expect(
        validateUploadKeyInput({
          category: "appliance",
          id: bad,
          version: "v1",
          kind: "model",
          extension: ".glb",
        }),
      ).toBe(false);
    }
  });

  it("accepts kebab-case ids", () => {
    for (const good of ["fridge", "fridge-01", "fridge_01", "a1b2"]) {
      expect(
        validateUploadKeyInput({
          category: "appliance",
          id: good,
          version: "v1",
          kind: "model",
          extension: ".glb",
        }),
      ).toBe(true);
    }
  });
});

describe("fileSizeAdvice — advisory only", () => {
  it("returns null for well-under-limit uploads", () => {
    expect(fileSizeAdvice(500_000, "furniture")).toBeNull();
    expect(fileSizeAdvice(500_000, "decor")).toBeNull();
  });

  it("returns a warning when the category budget is exceeded", () => {
    // furniture soft limit = 5 MB
    expect(fileSizeAdvice(6 * 1024 * 1024, "furniture")).not.toBeNull();
    // decor soft limit = 1 MB
    expect(fileSizeAdvice(2 * 1024 * 1024, "decor")).not.toBeNull();
  });
});

describe("assetUploadManifestSchema", () => {
  const sample = {
    id: "refrigerator-01",
    category: "appliance" as const,
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
    provenance: {
      sourceName: "Poly Haven",
      license: "CC0-1.0",
    },
    uploadedAt: "2026-08-29T00:00:00.000Z",
  };

  it("accepts a well-formed manifest", () => {
    expect(assetUploadManifestSchema.parse(sample)).toEqual(sample);
  });

  it("rejects a manifest with a bad sha256 (not 64 hex chars)", () => {
    expect(() =>
      assetUploadManifestSchema.parse({
        ...sample,
        model: { ...sample.model, sha256: "shortstring" },
      }),
    ).toThrow();
  });

  it("rejects a manifest missing provenance", () => {
    const { provenance: _, ...withoutProvenance } = sample;
    void _;
    expect(() => assetUploadManifestSchema.parse(withoutProvenance)).toThrow();
  });

  it("allows a model-only manifest (no thumbnail)", () => {
    const { thumbnail: _, ...modelOnly } = sample;
    void _;
    expect(() => assetUploadManifestSchema.parse(modelOnly)).not.toThrow();
  });
});

describe("IMMUTABLE_CACHE_CONTROL", () => {
  it("is the correct long-lived immutable string", () => {
    expect(IMMUTABLE_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
  });
});
