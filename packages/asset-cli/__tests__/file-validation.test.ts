import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateAndHashFile } from "../src/file-validation";

describe("validateAndHashFile", () => {
  let tmp: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmp = await mkdtemp(join(tmpdir(), "wc-asset-test-"));
    process.chdir(tmp);
  });
  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tmp, { recursive: true, force: true });
  });

  it("reads size + sha256 and returns the file body", async () => {
    const p = join(tmp, "model.glb");
    // Real GLB header ('glTF' + version + length placeholders).
    const body = Buffer.concat([Buffer.from("glTF", "ascii"), Buffer.alloc(16, 0)]);
    await writeFile(p, body);
    const result = await validateAndHashFile("./model.glb", {
      allowedExtensions: [".glb"],
      requireGlbHeader: true,
    });
    expect(result.basename).toBe("model.glb");
    expect(result.sizeBytes).toBe(body.length);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a file with the wrong extension", async () => {
    const p = join(tmp, "bad.obj");
    await writeFile(p, "junk");
    await expect(
      validateAndHashFile("./bad.obj", { allowedExtensions: [".glb"] }),
    ).rejects.toThrow(/Unsupported extension/);
  });

  it("rejects a .glb without the magic header when required", async () => {
    const p = join(tmp, "fake.glb");
    await writeFile(p, "not-glb-bytes");
    await expect(
      validateAndHashFile("./fake.glb", {
        allowedExtensions: [".glb"],
        requireGlbHeader: true,
      }),
    ).rejects.toThrow(/GLB magic header/);
  });

  it("rejects a missing file", async () => {
    await expect(
      validateAndHashFile("./does-not-exist.glb", { allowedExtensions: [".glb"] }),
    ).rejects.toThrow(/Cannot stat/);
  });

  it("enforces a maxBytes hard cap when provided", async () => {
    const p = join(tmp, "small.glb");
    await writeFile(
      p,
      Buffer.concat([Buffer.from("glTF", "ascii"), Buffer.alloc(100, 0)]),
    );
    await expect(
      validateAndHashFile("./small.glb", {
        allowedExtensions: [".glb"],
        maxBytes: 10,
      }),
    ).rejects.toThrow(/exceeds hard cap/);
  });
});
