import { describe, expect, it } from "vitest";
import {
  LOCAL_SCENE_ASSET_BASE,
  LOCAL_THUMBNAIL_SUBDIR,
  SCENE_ASSET_PREFIX,
  composeSceneAssetThumbnailUrl,
  composeSceneAssetUrl,
  normalizeAssetKey,
  toS3ObjectKey,
} from "../asset-url";

// Canonical layout: three distinct concepts.
//   · LOGICAL assetKey → `<category>/<id>/<version>/<file>` (no scene/)
//   · PHYSICAL S3 key  → `scene/<assetKey>`
//   · Public delivery  → `<base>/scene/<assetKey>` (local or CDN)

describe("normalizeAssetKey", () => {
  it("strips leading slashes but keeps interior path structure", () => {
    expect(normalizeAssetKey("appliance/fridge/v1/model.glb")).toBe(
      "appliance/fridge/v1/model.glb",
    );
    expect(normalizeAssetKey("/appliance/fridge/v1/model.glb")).toBe(
      "appliance/fridge/v1/model.glb",
    );
  });

  it("returns null for missing / non-string / empty input", () => {
    expect(normalizeAssetKey(undefined)).toBeNull();
    expect(normalizeAssetKey(null)).toBeNull();
    expect(normalizeAssetKey("")).toBeNull();
    expect(normalizeAssetKey("   ")).toBeNull();
    expect(normalizeAssetKey(123 as unknown as string)).toBeNull();
  });

  it("rejects absolute URLs (any scheme)", () => {
    expect(normalizeAssetKey("http://evil.example/a.glb")).toBeNull();
    expect(normalizeAssetKey("https://cdn.example/a.glb")).toBeNull();
    expect(normalizeAssetKey("s3://bucket/a.glb")).toBeNull();
    expect(normalizeAssetKey("file:///etc/passwd")).toBeNull();
  });

  it("rejects backslashes (Windows-style separators)", () => {
    expect(normalizeAssetKey("appliance\\fridge\\model.glb")).toBeNull();
  });

  it("rejects `..` and `.` path segments (traversal defense)", () => {
    expect(normalizeAssetKey("../../secret.glb")).toBeNull();
    expect(normalizeAssetKey("appliance/../../secret.glb")).toBeNull();
    expect(normalizeAssetKey("appliance/./fridge/model.glb")).toBeNull();
  });

  it("rejects empty segments (`//` in the path)", () => {
    expect(normalizeAssetKey("appliance//model.glb")).toBeNull();
  });

  it("rejects keys that already carry the `scene/` prefix — those are PHYSICAL keys, not LOGICAL", () => {
    expect(normalizeAssetKey("scene/appliance/fridge/v1/model.glb")).toBeNull();
    // Belt-and-suspenders: after leading-slash strip.
    expect(normalizeAssetKey("/scene/appliance/fridge/v1/model.glb")).toBeNull();
  });

  it("preserves unicode + hyphens + underscores in valid keys", () => {
    expect(normalizeAssetKey("appliance/refrigerator-01/v1/model.glb")).toBe(
      "appliance/refrigerator-01/v1/model.glb",
    );
    expect(normalizeAssetKey("furniture/sofa_3seat/v2/model.glb")).toBe(
      "furniture/sofa_3seat/v2/model.glb",
    );
  });
});

describe("toS3ObjectKey — logical → physical", () => {
  it("prepends the SCENE_ASSET_PREFIX exactly once", () => {
    expect(toS3ObjectKey("appliance/fridge/v1/model.glb")).toBe(
      "scene/appliance/fridge/v1/model.glb",
    );
    expect(SCENE_ASSET_PREFIX).toBe("scene");
  });

  it("returns null for logical keys that fail normalization", () => {
    expect(toS3ObjectKey(null)).toBeNull();
    expect(toS3ObjectKey("scene/appliance/fridge/v1/model.glb")).toBeNull();
    expect(toS3ObjectKey("../secret.glb")).toBeNull();
  });
});

describe("composeSceneAssetUrl — LOCAL base (`/assets`)", () => {
  it("adds `scene/` between the local base and the logical key", () => {
    expect(composeSceneAssetUrl(LOCAL_SCENE_ASSET_BASE, "appliance/fridge/v1/model.glb")).toBe(
      "/assets/scene/appliance/fridge/v1/model.glb",
    );
  });

  it("LOCAL_SCENE_ASSET_BASE is `/assets` (no scene/ baked in)", () => {
    expect(LOCAL_SCENE_ASSET_BASE).toBe("/assets");
  });

  it("returns null for invalid keys", () => {
    expect(composeSceneAssetUrl(LOCAL_SCENE_ASSET_BASE, null)).toBeNull();
    expect(composeSceneAssetUrl(LOCAL_SCENE_ASSET_BASE, "../secret.glb")).toBeNull();
  });
});

describe("composeSceneAssetUrl — CDN base (absolute URL)", () => {
  it("mounts under `<base>/scene/<key>`", () => {
    expect(
      composeSceneAssetUrl(
        "https://assets.example.com",
        "appliance/fridge/v1/model.glb",
      ),
    ).toBe("https://assets.example.com/scene/appliance/fridge/v1/model.glb");
  });

  it("strips trailing slashes on the base URL", () => {
    expect(
      composeSceneAssetUrl("https://cdn.example///", "appliance/fridge/v1/model.glb"),
    ).toBe("https://cdn.example/scene/appliance/fridge/v1/model.glb");
  });
});

describe("composeSceneAssetThumbnailUrl", () => {
  it("mounts bare filenames under `scene/thumbnails/…`", () => {
    expect(composeSceneAssetThumbnailUrl(LOCAL_SCENE_ASSET_BASE, "fridge.webp")).toBe(
      `/assets/scene/${LOCAL_THUMBNAIL_SUBDIR}/fridge.webp`,
    );
  });

  it("mounts structured keys under `scene/<key>` (same as model)", () => {
    expect(
      composeSceneAssetThumbnailUrl(
        LOCAL_SCENE_ASSET_BASE,
        "appliance/fridge/v1/thumbnail.webp",
      ),
    ).toBe("/assets/scene/appliance/fridge/v1/thumbnail.webp");
  });

  it("returns null for invalid input", () => {
    expect(composeSceneAssetThumbnailUrl(LOCAL_SCENE_ASSET_BASE, null)).toBeNull();
    expect(
      composeSceneAssetThumbnailUrl(LOCAL_SCENE_ASSET_BASE, "../../secret.webp"),
    ).toBeNull();
  });
});

describe("Three-layer contract: local, S3-physical, CDN all map to the same logical asset", () => {
  const logical = "appliance/refrigerator-01/v1/model.glb";

  it("logical → PHYSICAL S3 key = `scene/<logical>`", () => {
    expect(toS3ObjectKey(logical)).toBe(`${SCENE_ASSET_PREFIX}/${logical}`);
  });

  it("logical → LOCAL URL = `/assets/scene/<logical>`", () => {
    expect(composeSceneAssetUrl(LOCAL_SCENE_ASSET_BASE, logical)).toBe(
      `/assets/${SCENE_ASSET_PREFIX}/${logical}`,
    );
  });

  it("logical → CDN URL = `<CDN>/scene/<logical>`", () => {
    const cdn = "https://d123abc.cloudfront.net";
    expect(composeSceneAssetUrl(cdn, logical)).toBe(
      `${cdn}/${SCENE_ASSET_PREFIX}/${logical}`,
    );
  });

  it("no path double-nests `scene/scene/…` under any base configuration", () => {
    for (const base of [
      "/assets",
      "/assets/",
      "https://cdn.example",
      "https://cdn.example/",
      "https://s3-bucket.s3.us-east-1.amazonaws.com",
    ]) {
      const url = composeSceneAssetUrl(base, logical);
      expect(url).not.toBeNull();
      expect(url!).not.toContain("//scene");
      expect(url!).not.toContain("scene/scene");
    }
  });
});
