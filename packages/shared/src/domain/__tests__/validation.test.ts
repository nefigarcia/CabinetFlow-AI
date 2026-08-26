import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "../validation/issue";
import {
  hasBlockingIssue,
  highestSeverity,
  issuesBySource,
  validationIssueSchema,
  validationReportV2Schema,
} from "../validation/issue";

function issue(overrides: Partial<ValidationIssue> & { id: string; code: string }): ValidationIssue {
  return {
    source: "geometry",
    severity: "info",
    message: "test",
    ...overrides,
  };
}

describe("ValidationIssue schema", () => {
  it("accepts a rich, measured, blocking issue", () => {
    const it_ = issue({
      id: "iss_1",
      code: "DRAWER_SLIDE_CLEARANCE",
      source: "hardware",
      severity: "blocking",
      cabinetId: "cab_1",
      partId: "p_1",
      message: "Drawer clearance below required value",
      measuredValue: 8.2,
      requiredValue: 12.5,
      unit: "mm",
    });
    expect(() => validationIssueSchema.parse(it_)).not.toThrow();
  });

  it("rejects an unknown source value", () => {
    expect(() =>
      validationIssueSchema.parse({
        id: "x",
        code: "X",
        source: "cosmic-rays",
        severity: "warning",
        message: "y",
      }),
    ).toThrow();
  });

  it("rejects an unknown severity value", () => {
    expect(() =>
      validationIssueSchema.parse({
        id: "x",
        code: "X",
        source: "ai",
        severity: "catastrophic",
        message: "y",
      }),
    ).toThrow();
  });
});

describe("highestSeverity", () => {
  it("returns null for an empty list", () => {
    expect(highestSeverity([])).toBeNull();
  });

  it("returns the highest severity present", () => {
    const issues: ValidationIssue[] = [
      issue({ id: "1", code: "A", severity: "info" }),
      issue({ id: "2", code: "B", severity: "warning" }),
      issue({ id: "3", code: "C", severity: "error" }),
    ];
    expect(highestSeverity(issues)).toBe("error");
  });

  it("blocking outranks error", () => {
    const issues: ValidationIssue[] = [
      issue({ id: "1", code: "A", severity: "error" }),
      issue({ id: "2", code: "B", severity: "blocking" }),
    ];
    expect(highestSeverity(issues)).toBe("blocking");
  });
});

describe("issuesBySource", () => {
  it("buckets issues by source discriminator", () => {
    const buckets = issuesBySource([
      issue({ id: "1", code: "A", source: "geometry" }),
      issue({ id: "2", code: "B", source: "geometry" }),
      issue({ id: "3", code: "C", source: "hardware" }),
      issue({ id: "4", code: "D", source: "ai" }),
    ]);
    expect(buckets.geometry).toHaveLength(2);
    expect(buckets.hardware).toHaveLength(1);
    expect(buckets.ai).toHaveLength(1);
    expect(buckets.manufacturing).toHaveLength(0);
    expect(buckets.installation).toHaveLength(0);
    expect(buckets.construction).toHaveLength(0);
  });
});

describe("hasBlockingIssue", () => {
  it("returns true when any issue has severity blocking", () => {
    expect(
      hasBlockingIssue([
        issue({ id: "1", code: "A", severity: "warning" }),
        issue({ id: "2", code: "B", severity: "blocking" }),
      ]),
    ).toBe(true);
  });

  it("returns false otherwise", () => {
    expect(
      hasBlockingIssue([
        issue({ id: "1", code: "A", severity: "warning" }),
        issue({ id: "2", code: "B", severity: "error" }),
      ]),
    ).toBe(false);
  });
});

describe("ValidationReportV2 schema", () => {
  it("accepts a report with profile version snapshot and issue list", () => {
    const report = {
      id: "rep_1",
      createdAt: "2026-08-24T00:00:00.000Z",
      documentSchemaVersion: "1.0",
      profileVersions: {
        construction: { id: "legacy-visual", version: 1 },
        material: { id: "mat_1", version: 1 },
      },
      issues: [
        issue({
          id: "iss_1",
          code: "PANEL_TOO_THIN",
          source: "construction",
          severity: "error",
          measuredValue: 12,
          requiredValue: 18,
          unit: "mm",
        }),
      ],
    };
    expect(() => validationReportV2Schema.parse(report)).not.toThrow();
  });
});
