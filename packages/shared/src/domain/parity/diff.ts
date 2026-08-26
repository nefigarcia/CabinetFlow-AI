// Snapshot diff engine.
//
// Compares two GeometryParitySnapshots for the same cabinet and emits a
// structured, deterministic difference report. Uses the parity tolerance
// policy (see tolerance.ts). Does NOT normalize either side — mismatches
// are reported verbatim.

import {
  GEOMETRY_COMPARE_TOLERANCE_MM,
  deltaMm,
  nearlyEqualMm,
} from "./tolerance";
import type {
  GeometryParitySnapshot,
  SnapshotPart,
} from "./snapshot";

export type DiffSeverity = "info" | "warning" | "difference";

export interface FieldDiff {
  field: string;
  severity: DiffSeverity;
  aValue: number | string | boolean | null | undefined;
  bValue: number | string | boolean | null | undefined;
  deltaMm?: number;
  unit?: string;
  note?: string;
}

export interface PartRoleDiff {
  role: SnapshotPart["role"];
  aCount: number;
  bCount: number;
  countMatch: boolean;
  // A representative dimension diff for the FIRST part with this role in
  // each snapshot. If either side has zero parts with this role, this is
  // omitted. Present only when countMatch is true.
  widthDeltaMm?: number;
  heightDeltaMm?: number;
  thicknessDeltaMm?: number;
}

export interface SnapshotDiff {
  cabinetId: string;
  aSource: string;
  bSource: string;
  toleranceMm: number;

  boundingBox: FieldDiff[];
  toeKick: FieldDiff[];
  countertop: FieldDiff[];
  faceFrame: FieldDiff[];
  shelfPin: FieldDiff[];

  parts: PartRoleDiff[];

  /** Total count of `FieldDiff` items with severity "difference". */
  differenceCount: number;
  /** True when NO significant differences were detected. */
  matches: boolean;
}

// ── Field-level comparators ──────────────────────────────────────────────────

function compareNumber(
  field: string,
  a: number | undefined,
  b: number | undefined,
  unit = "mm",
): FieldDiff {
  if (a === undefined && b === undefined) {
    return { field, severity: "info", aValue: null, bValue: null, unit };
  }
  if (a === undefined) {
    return { field, severity: "difference", aValue: null, bValue: b ?? null, unit, note: "A does not model this concept" };
  }
  if (b === undefined) {
    return { field, severity: "difference", aValue: a ?? null, bValue: null, unit, note: "B does not model this concept" };
  }
  if (nearlyEqualMm(a, b)) {
    return { field, severity: "info", aValue: a, bValue: b, deltaMm: 0, unit };
  }
  return {
    field,
    severity: "difference",
    aValue: a,
    bValue: b,
    deltaMm: deltaMm(a, b),
    unit,
  };
}

function compareBool(field: string, a: boolean, b: boolean): FieldDiff {
  return a === b
    ? { field, severity: "info", aValue: a, bValue: b }
    : { field, severity: "difference", aValue: a, bValue: b };
}

// ── Section comparators ─────────────────────────────────────────────────────

function diffBoundingBox(a: GeometryParitySnapshot, b: GeometryParitySnapshot): FieldDiff[] {
  return [
    compareNumber("boundingBox.widthMm", a.boundingBox.widthMm, b.boundingBox.widthMm),
    compareNumber("boundingBox.heightMm", a.boundingBox.heightMm, b.boundingBox.heightMm),
    compareNumber("boundingBox.depthMm", a.boundingBox.depthMm, b.boundingBox.depthMm),
  ];
}

function diffToeKick(a: GeometryParitySnapshot, b: GeometryParitySnapshot): FieldDiff[] {
  const at = a.features?.toeKick;
  const bt = b.features?.toeKick;
  const out: FieldDiff[] = [];
  out.push(compareBool("toeKick.present", !!at?.present, !!bt?.present));
  out.push(compareNumber("toeKick.heightMm", at?.heightMm, bt?.heightMm));
  out.push(compareNumber("toeKick.depthMm", at?.depthMm, bt?.depthMm));
  return out;
}

function diffCountertop(a: GeometryParitySnapshot, b: GeometryParitySnapshot): FieldDiff[] {
  const ac = a.features?.countertop ?? null;
  const bc = b.features?.countertop ?? null;
  const out: FieldDiff[] = [];
  out.push(compareBool("countertop.present", !!ac, !!bc));
  out.push(compareNumber("countertop.thicknessMm", ac?.thicknessMm, bc?.thicknessMm));
  out.push(compareNumber("countertop.frontOverhangMm", ac?.frontOverhangMm, bc?.frontOverhangMm));
  out.push(compareNumber("countertop.sideOverhangMm", ac?.sideOverhangMm, bc?.sideOverhangMm));
  return out;
}

function diffFaceFrame(a: GeometryParitySnapshot, b: GeometryParitySnapshot): FieldDiff[] {
  const af = a.features?.faceFrame ?? null;
  const bf = b.features?.faceFrame ?? null;
  const out: FieldDiff[] = [];
  out.push(compareBool("faceFrame.present", !!af, !!bf));
  out.push(compareNumber("faceFrame.stileWidthMm", af?.stileWidthMm, bf?.stileWidthMm));
  out.push(compareNumber("faceFrame.railWidthMm", af?.railWidthMm, bf?.railWidthMm));
  out.push(compareNumber("faceFrame.thicknessMm", af?.thicknessMm, bf?.thicknessMm));
  return out;
}

function diffShelfPin(a: GeometryParitySnapshot, b: GeometryParitySnapshot): FieldDiff[] {
  const ap = a.features?.shelfPin;
  const bp = b.features?.shelfPin;
  const out: FieldDiff[] = [];
  out.push(compareNumber("shelfPin.spacingMm", ap?.spacingMm, bp?.spacingMm));
  out.push(compareNumber("shelfPin.rowInsetMm", ap?.rowInsetMm, bp?.rowInsetMm));
  out.push(compareNumber("shelfPin.diameterMm", ap?.diameterMm, bp?.diameterMm));
  return out;
}

function diffPartsByRole(
  a: GeometryParitySnapshot,
  b: GeometryParitySnapshot,
): PartRoleDiff[] {
  const roles = new Set<SnapshotPart["role"]>();
  a.parts.forEach((p) => roles.add(p.role));
  b.parts.forEach((p) => roles.add(p.role));

  const rows: PartRoleDiff[] = [];
  for (const role of Array.from(roles).sort()) {
    const aParts = a.parts.filter((p) => p.role === role);
    const bParts = b.parts.filter((p) => p.role === role);
    const countMatch = aParts.length === bParts.length;

    const row: PartRoleDiff = {
      role,
      aCount: aParts.length,
      bCount: bParts.length,
      countMatch,
    };

    if (countMatch && aParts.length > 0) {
      const [aFirst] = aParts;
      const [bFirst] = bParts;
      if (aFirst && bFirst) {
        row.widthDeltaMm = deltaMm(aFirst.widthMm, bFirst.widthMm);
        row.heightDeltaMm = deltaMm(aFirst.heightMm, bFirst.heightMm);
        row.thicknessDeltaMm = deltaMm(aFirst.thicknessMm, bFirst.thicknessMm);
      }
    }
    rows.push(row);
  }
  return rows;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function diffSnapshots(
  a: GeometryParitySnapshot,
  b: GeometryParitySnapshot,
): SnapshotDiff {
  if (a.cabinetId !== b.cabinetId) {
    throw new Error(
      `diffSnapshots: cabinetId mismatch (${a.cabinetId} vs ${b.cabinetId})`,
    );
  }

  const boundingBox = diffBoundingBox(a, b);
  const toeKick = diffToeKick(a, b);
  const countertop = diffCountertop(a, b);
  const faceFrame = diffFaceFrame(a, b);
  const shelfPin = diffShelfPin(a, b);
  const parts = diffPartsByRole(a, b);

  const differenceCount =
    countDiffs(boundingBox) +
    countDiffs(toeKick) +
    countDiffs(countertop) +
    countDiffs(faceFrame) +
    countDiffs(shelfPin) +
    parts.filter(
      (p) =>
        !p.countMatch ||
        (p.widthDeltaMm !== undefined && Math.abs(p.widthDeltaMm) > GEOMETRY_COMPARE_TOLERANCE_MM) ||
        (p.heightDeltaMm !== undefined && Math.abs(p.heightDeltaMm) > GEOMETRY_COMPARE_TOLERANCE_MM) ||
        (p.thicknessDeltaMm !== undefined && Math.abs(p.thicknessDeltaMm) > GEOMETRY_COMPARE_TOLERANCE_MM),
    ).length;

  return {
    cabinetId: a.cabinetId,
    aSource: a.source,
    bSource: b.source,
    toleranceMm: GEOMETRY_COMPARE_TOLERANCE_MM,
    boundingBox,
    toeKick,
    countertop,
    faceFrame,
    shelfPin,
    parts,
    differenceCount,
    matches: differenceCount === 0,
  };
}

function countDiffs(diffs: FieldDiff[]): number {
  return diffs.filter((d) => d.severity === "difference").length;
}
