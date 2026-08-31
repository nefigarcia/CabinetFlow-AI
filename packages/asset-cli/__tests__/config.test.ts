import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns region + bucket when both env vars are present", () => {
    const cfg = loadConfig({
      AWS_REGION: "us-east-1",
      S3_BUCKET_NAME: "woodcraft-os-files",
      AWS_ACCESS_KEY_ID: "key",
      AWS_SECRET_ACCESS_KEY: "secret",
    } as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ region: "us-east-1", bucketName: "woodcraft-os-files" });
  });

  it("throws when AWS_REGION is missing", () => {
    expect(() => loadConfig({ S3_BUCKET_NAME: "b" } as NodeJS.ProcessEnv)).toThrow(
      /AWS_REGION/,
    );
  });

  it("throws when S3_BUCKET_NAME is missing", () => {
    expect(() => loadConfig({ AWS_REGION: "us-east-1" } as NodeJS.ProcessEnv)).toThrow(
      /S3_BUCKET_NAME/,
    );
  });

  it("warns (does not throw) when access keys are missing", () => {
    loadConfig({
      AWS_REGION: "us-east-1",
      S3_BUCKET_NAME: "b",
    } as NodeJS.ProcessEnv);
    expect(warnSpy).toHaveBeenCalled();
  });
});
