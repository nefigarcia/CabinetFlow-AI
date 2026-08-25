import { describe, expect, it } from "vitest";
import {
  geometryParitySnapshotSchema,
  sortSnapshotParts,
} from "../snapshot";
import { buildPythonPredictedSnapshot } from "../snapshot-python-predicted";
import { buildTypeScriptSnapshot } from "../snapshot-typescript";
import { PARITY_FIXTURES } from "../fixtures";

describe("snapshot normalization", () => {
  it("TS snapshots validate against the schema for every fixture", () => {
    for (const fx of PARITY_FIXTURES) {
      const snap = buildTypeScriptSnapshot(fx.cabinet);
      expect(() => geometryParitySnapshotSchema.parse(snap)).not.toThrow();
    }
  });

  it("Python-predicted snapshots validate against the schema for every fixture", () => {
    for (const fx of PARITY_FIXTURES) {
      const snap = buildPythonPredictedSnapshot(fx.cabinet);
      expect(() => geometryParitySnapshotSchema.parse(snap)).not.toThrow();
    }
  });

  it("TS snapshots are deterministic across calls", () => {
    for (const fx of PARITY_FIXTURES) {
      const a = buildTypeScriptSnapshot(fx.cabinet);
      const b = buildTypeScriptSnapshot(fx.cabinet);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("Python-predicted snapshots are deterministic across calls", () => {
    for (const fx of PARITY_FIXTURES) {
      const a = buildPythonPredictedSnapshot(fx.cabinet);
      const b = buildPythonPredictedSnapshot(fx.cabinet);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("bounding box always mirrors the fixture cabinet dimensions", () => {
    for (const fx of PARITY_FIXTURES) {
      const ts = buildTypeScriptSnapshot(fx.cabinet);
      const py = buildPythonPredictedSnapshot(fx.cabinet);
      expect(ts.boundingBox.widthMm).toBe(fx.cabinet.width);
      expect(py.boundingBox.widthMm).toBe(fx.cabinet.width);
      expect(ts.boundingBox.heightMm).toBe(fx.cabinet.height);
      expect(py.boundingBox.heightMm).toBe(fx.cabinet.height);
    }
  });

  it("TS snapshot uses 19 mm panel thickness (from inventory)", () => {
    const ts = buildTypeScriptSnapshot(PARITY_FIXTURES[0]!.cabinet);
    const leftPanel = ts.parts.find((p) => p.role === "left_panel");
    expect(leftPanel).toBeDefined();
    expect(leftPanel!.thicknessMm).toBe(19);
  });

  it("Python-predicted snapshot uses 18 mm panel thickness (from inventory)", () => {
    const py = buildPythonPredictedSnapshot(PARITY_FIXTURES[0]!.cabinet);
    const leftPanel = py.parts.find((p) => p.role === "left_panel");
    expect(leftPanel).toBeDefined();
    expect(leftPanel!.thicknessMm).toBe(18);
  });

  it("TS snapshot toe kick is 89 mm; Python-predicted is 96 mm", () => {
    const ts = buildTypeScriptSnapshot(PARITY_FIXTURES[0]!.cabinet);
    const py = buildPythonPredictedSnapshot(PARITY_FIXTURES[0]!.cabinet);
    expect(ts.features?.toeKick?.heightMm).toBe(89);
    expect(py.features?.toeKick?.heightMm).toBe(96);
  });

  it("Python-predicted snapshot includes a back panel; TS does not (for closed cabinets)", () => {
    const py = buildPythonPredictedSnapshot(PARITY_FIXTURES[0]!.cabinet);
    const ts = buildTypeScriptSnapshot(PARITY_FIXTURES[0]!.cabinet);
    expect(py.parts.some((p) => p.role === "back_panel")).toBe(true);
    expect(ts.parts.some((p) => p.role === "back_panel")).toBe(false);
  });

  it("Python-predicted sink base has a sink stretcher and no bottom panel", () => {
    const sink = PARITY_FIXTURES.find((f) => f.id === "sink-base")!;
    const py = buildPythonPredictedSnapshot(sink.cabinet);
    expect(py.parts.some((p) => p.role === "sink_stretcher")).toBe(true);
    expect(py.parts.some((p) => p.role === "bottom_panel")).toBe(false);
  });

  it("Python-predicted face-frame cabinet emits face_frame_stile and _rail parts", () => {
    const ff = PARITY_FIXTURES.find((f) => f.id === "face-frame-base")!;
    const py = buildPythonPredictedSnapshot(ff.cabinet);
    expect(py.parts.some((p) => p.role === "face_frame_stile")).toBe(true);
    expect(py.parts.some((p) => p.role === "face_frame_rail")).toBe(true);
  });

  it("Python-predicted drawer base emits drawer_box_side/back/bottom parts", () => {
    const db = PARITY_FIXTURES.find((f) => f.id === "frameless-3drawer-base")!;
    const py = buildPythonPredictedSnapshot(db.cabinet);
    expect(py.parts.some((p) => p.role === "drawer_box_side")).toBe(true);
    expect(py.parts.some((p) => p.role === "drawer_box_back")).toBe(true);
    expect(py.parts.some((p) => p.role === "drawer_box_bottom")).toBe(true);
  });

  it("sortSnapshotParts produces a canonical order", () => {
    const parts = [
      { role: "top_panel", widthMm: 100, heightMm: 10, thicknessMm: 18, quantity: 1 },
      { role: "left_panel", widthMm: 200, heightMm: 700, thicknessMm: 18, quantity: 1 },
      { role: "left_panel", widthMm: 100, heightMm: 700, thicknessMm: 18, quantity: 1 },
    ] as const;
    const sorted = sortSnapshotParts([...parts]);
    expect(sorted.map((p) => `${p.role}:${p.widthMm}`)).toEqual([
      "left_panel:100",
      "left_panel:200",
      "top_panel:100",
    ]);
  });
});
