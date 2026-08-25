// Human-readable parity report formatting.
//
// Consumes a SnapshotDiff and emits a deterministic, review-friendly
// markdown/plaintext report. Used by tests and by the future V2.1B
// verification workflow when comparing against real shop measurements.

import type { FieldDiff, PartRoleDiff, SnapshotDiff } from "./diff";

const bullet = "  •";

function formatValue(v: number | string | boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

function formatFieldDiff(d: FieldDiff): string {
  const a = formatValue(d.aValue);
  const b = formatValue(d.bValue);
  const unit = d.unit ? ` ${d.unit}` : "";
  if (d.severity === "difference") {
    const delta = d.deltaMm !== undefined ? ` (Δ ${d.deltaMm >= 0 ? "+" : ""}${d.deltaMm}${unit})` : "";
    const note = d.note ? ` — ${d.note}` : "";
    return `${bullet} ✗ ${d.field}: ${a}${unit} vs ${b}${unit}${delta}${note}`;
  }
  if (d.severity === "warning") {
    return `${bullet} ! ${d.field}: ${a}${unit} vs ${b}${unit}`;
  }
  return `${bullet} ✓ ${d.field}: ${a}${unit} vs ${b}${unit}`;
}

function formatPartDiff(p: PartRoleDiff): string {
  if (!p.countMatch) {
    return `${bullet} ✗ ${p.role}: count ${p.aCount} vs ${p.bCount}`;
  }
  const w = p.widthDeltaMm ?? 0;
  const h = p.heightDeltaMm ?? 0;
  const t = p.thicknessDeltaMm ?? 0;
  const anyDelta = Math.abs(w) > 0 || Math.abs(h) > 0 || Math.abs(t) > 0;
  const marker = anyDelta ? "✗" : "✓";
  return `${bullet} ${marker} ${p.role}: qty ${p.aCount} — Δ w=${w} h=${h} t=${t}`;
}

/**
 * Renders a SnapshotDiff as a plaintext report suitable for review, CI
 * logs, and the future parity dashboard.
 */
export function formatSnapshotDiffReport(diff: SnapshotDiff): string {
  const lines: string[] = [];
  lines.push(`Fixture: ${diff.cabinetId}`);
  lines.push(`Compare: ${diff.aSource} vs ${diff.bSource}`);
  lines.push(`Tolerance: ${diff.toleranceMm} mm`);
  lines.push(`Result: ${diff.matches ? "MATCH" : `${diff.differenceCount} difference(s) detected`}`);
  lines.push("");

  lines.push("Bounding box:");
  diff.boundingBox.forEach((d) => lines.push(formatFieldDiff(d)));
  lines.push("");

  lines.push("Toe kick:");
  diff.toeKick.forEach((d) => lines.push(formatFieldDiff(d)));
  lines.push("");

  lines.push("Countertop:");
  diff.countertop.forEach((d) => lines.push(formatFieldDiff(d)));
  lines.push("");

  lines.push("Face frame:");
  diff.faceFrame.forEach((d) => lines.push(formatFieldDiff(d)));
  lines.push("");

  lines.push("Shelf-pin pattern:");
  diff.shelfPin.forEach((d) => lines.push(formatFieldDiff(d)));
  lines.push("");

  lines.push("Parts (grouped by role):");
  diff.parts.forEach((p) => lines.push(formatPartDiff(p)));
  lines.push("");

  return lines.join("\n");
}
