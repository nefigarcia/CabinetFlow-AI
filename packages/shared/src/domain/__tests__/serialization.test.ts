import { describe, expect, it } from "vitest";
import {
  CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION,
  cabinetDesignDocumentV1Schema,
  parseCabinetDesignDocumentV1,
  serializeCabinetDesignDocumentV1,
} from "../design-document";
import { makeDemoDocument } from "./fixtures";

describe("CabinetDesignDocumentV1 serialization", () => {
  it("round-trips a demo document through JSON without losing information", () => {
    const original = makeDemoDocument();
    const json = serializeCabinetDesignDocumentV1(original);
    const restored = parseCabinetDesignDocumentV1(JSON.parse(json));
    expect(restored).toEqual(original);
  });

  it("rejects a document with the wrong schemaVersion", () => {
    const doc = makeDemoDocument();
    const mutated = { ...doc, schemaVersion: "9.9" };
    expect(() => parseCabinetDesignDocumentV1(mutated)).toThrow();
  });

  it("rejects a document missing required profile arrays", () => {
    const doc = makeDemoDocument() as unknown as Record<string, unknown>;
    delete doc["constructionProfiles"];
    expect(() => parseCabinetDesignDocumentV1(doc)).toThrow();
  });

  it("locks the schemaVersion literal to '1.0'", () => {
    expect(CABINET_DESIGN_DOCUMENT_SCHEMA_VERSION).toBe("1.0");
  });

  it("preserves legacyParameters, extra, legacyCutParams through the round-trip", () => {
    const original = makeDemoDocument();
    const cab = original.rooms[0]!.cabinets[0]!;
    cab.legacyParameters = { ecabsExportedAt: "2020-01-01", hingeType: "blum-clip-top" };
    cab.parameters.extra = { hingeType: "blum-clip-top" };
    cab.parts[0]!.legacyCutParams = { note: "Legacy joinery blob" };

    const restored = parseCabinetDesignDocumentV1(
      JSON.parse(serializeCabinetDesignDocumentV1(original)),
    );
    const rCab = restored.rooms[0]!.cabinets[0]!;
    expect(rCab.legacyParameters).toEqual({
      ecabsExportedAt: "2020-01-01",
      hingeType: "blum-clip-top",
    });
    expect(rCab.parameters.extra).toEqual({ hingeType: "blum-clip-top" });
    expect(rCab.parts[0]!.legacyCutParams).toEqual({ note: "Legacy joinery blob" });
  });

  it("zod schema accepts a stripped-down minimal document", () => {
    const minimal = {
      schemaVersion: "1.0",
      organizationId: "org",
      projectId: "proj",
      units: "mm",
      revision: 0,
      rooms: [],
      constructionProfiles: [],
      materialProfiles: [],
      hardwareProfiles: [],
    };
    const parsed = cabinetDesignDocumentV1Schema.parse(minimal);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.rooms).toEqual([]);
  });
});
