import { describe, expect, it } from "vitest";
import { UsageError, parseUploadArgs } from "../src/argv";

describe("parseUploadArgs", () => {
  const minValid = [
    "--category", "appliance",
    "--id", "refrigerator-01",
    "--version", "v1",
    "--model", "./model.glb",
    "--license", "CC0-1.0",
    "--source-name", "Poly Haven",
  ];

  it("parses the minimum required argument set", () => {
    const p = parseUploadArgs(minValid);
    expect(p).toMatchObject({
      category: "appliance",
      id: "refrigerator-01",
      version: "v1",
      model: "./model.glb",
      license: "CC0-1.0",
      sourceName: "Poly Haven",
      dryRun: false,
      writeManifest: true,
    });
    expect(p.thumbnail).toBeUndefined();
  });

  it("accepts --key=value style", () => {
    const p = parseUploadArgs([
      "--category=furniture",
      "--id=sofa-3seat",
      "--version=v1",
      "--model=./m.glb",
      "--license=CC0-1.0",
      "--source-name=Author",
    ]);
    expect(p.category).toBe("furniture");
    expect(p.id).toBe("sofa-3seat");
  });

  it("throws UsageError when required args are missing", () => {
    expect(() => parseUploadArgs(["--category", "appliance"])).toThrow(UsageError);
  });

  it("rejects unknown categories", () => {
    expect(() =>
      parseUploadArgs([
        "--category", "unicorn",
        "--id", "x",
        "--version", "v1",
        "--model", "./m.glb",
        "--license", "x",
        "--source-name", "x",
      ]),
    ).toThrow(/Unknown --category/);
  });

  it("supports --dry-run flag", () => {
    const p = parseUploadArgs([...minValid, "--dry-run"]);
    expect(p.dryRun).toBe(true);
  });

  it("supports --no-manifest flag", () => {
    const p = parseUploadArgs([...minValid, "--no-manifest"]);
    expect(p.writeManifest).toBe(false);
  });

  it("carries optional provenance fields through", () => {
    const p = parseUploadArgs([
      ...minValid,
      "--author", "Jane Doe",
      "--source-url", "https://example.com/a",
      "--acquired-at", "2026-08-29",
      "--notes", "decimated to 25k tris",
    ]);
    expect(p.author).toBe("Jane Doe");
    expect(p.sourceUrl).toBe("https://example.com/a");
    expect(p.acquiredAt).toBe("2026-08-29");
    expect(p.notes).toBe("decimated to 25k tris");
  });
});
