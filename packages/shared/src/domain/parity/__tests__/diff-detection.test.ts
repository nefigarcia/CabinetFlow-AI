import { describe, expect, it } from "vitest";
import { diffSnapshots } from "../diff";
import { PARITY_FIXTURES } from "../fixtures";
import { formatSnapshotDiffReport } from "../report";
import { buildPythonPredictedSnapshot } from "../snapshot-python-predicted";
import { buildTypeScriptSnapshot } from "../snapshot-typescript";

describe("diff engine — detection of known divergences", () => {
  it("detects the 89 vs 96 mm toe-kick delta on a base cabinet", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(ts, py);

    const toeHeightDiff = diff.toeKick.find((d) => d.field === "toeKick.heightMm");
    expect(toeHeightDiff).toBeDefined();
    expect(toeHeightDiff!.severity).toBe("difference");
    expect(toeHeightDiff!.aValue).toBe(89);
    expect(toeHeightDiff!.bValue).toBe(96);
    expect(toeHeightDiff!.deltaMm).toBe(7);
  });

  it("detects the 19 vs 18 mm panel thickness delta", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(ts, py);

    const leftPanel = diff.parts.find((p) => p.role === "left_panel");
    expect(leftPanel).toBeDefined();
    expect(leftPanel!.thicknessDeltaMm).toBe(-1);
  });

  it("detects that TS has a countertop and Python-predicted does not (kitchen base)", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(ts, py);
    const presence = diff.countertop.find((d) => d.field === "countertop.present");
    expect(presence).toBeDefined();
    expect(presence!.severity).toBe("difference");
    expect(presence!.aValue).toBe(true);
    expect(presence!.bValue).toBe(false);
  });

  it("detects that Python has back_panel and TS does not", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(ts, py);
    const backPanel = diff.parts.find((p) => p.role === "back_panel");
    expect(backPanel).toBeDefined();
    expect(backPanel!.aCount).toBe(0);
    expect(backPanel!.bCount).toBe(1);
    expect(backPanel!.countMatch).toBe(false);
  });

  it("bounding box always matches (both sides use the same input dimensions)", () => {
    for (const fx of PARITY_FIXTURES) {
      const ts = buildTypeScriptSnapshot(fx.cabinet);
      const py = buildPythonPredictedSnapshot(fx.cabinet);
      const diff = diffSnapshots(ts, py);
      for (const d of diff.boundingBox) {
        expect(d.severity, `${fx.id}: ${d.field} should MATCH`).toBe("info");
      }
    }
  });

  it("every fixture is currently divergent (matches STEP 1 expectation)", () => {
    for (const fx of PARITY_FIXTURES) {
      const ts = buildTypeScriptSnapshot(fx.cabinet);
      const py = buildPythonPredictedSnapshot(fx.cabinet);
      const diff = diffSnapshots(ts, py);
      expect(diff.matches, `${fx.id} should currently show at least one difference`).toBe(false);
      expect(diff.differenceCount).toBeGreaterThan(0);
    }
  });

  it("comparing a TS snapshot to itself returns matches:true", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const diff = diffSnapshots(ts, ts);
    expect(diff.matches).toBe(true);
    expect(diff.differenceCount).toBe(0);
  });

  it("comparing a Python-predicted snapshot to itself returns matches:true", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(py, py);
    expect(diff.matches).toBe(true);
    expect(diff.differenceCount).toBe(0);
  });

  it("throws when cabinetId does not match between snapshots", () => {
    const a = buildTypeScriptSnapshot(PARITY_FIXTURES[0]!.cabinet);
    const b = buildTypeScriptSnapshot(PARITY_FIXTURES[1]!.cabinet);
    expect(() => diffSnapshots(a, b)).toThrow();
  });

  it("report formatter produces deterministic output containing the deltas", () => {
    const cab = PARITY_FIXTURES[0]!.cabinet;
    const ts = buildTypeScriptSnapshot(cab);
    const py = buildPythonPredictedSnapshot(cab);
    const diff = diffSnapshots(ts, py);
    const report = formatSnapshotDiffReport(diff);
    expect(report).toContain(cab.id);
    expect(report).toContain("typescript");
    expect(report).toContain("python-predicted");
    expect(report).toContain("toeKick.heightMm");
    expect(report).toContain("+7"); // toe-kick delta
  });
});
