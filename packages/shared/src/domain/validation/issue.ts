import { z } from "zod";

export type ValidationSource =
  | "geometry"
  | "construction"
  | "hardware"
  | "manufacturing"
  | "installation"
  | "ai";

export type ValidationSeverity = "info" | "warning" | "error" | "blocking";

export interface ValidationIssue {
  id: string;
  code: string;
  source: ValidationSource;
  severity: ValidationSeverity;

  roomId?: string;
  cabinetId?: string;
  partId?: string;

  message: string;

  measuredValue?: number;
  requiredValue?: number;
  unit?: string;

  metadata?: Record<string, unknown>;
}

export interface ProfileVersionSnapshot {
  construction?: { id: string; version: number };
  material?: { id: string; version: number };
  hardware?: { id: string; version: number };
}

export interface ValidationReportV2 {
  id: string;
  createdAt: string;
  documentSchemaVersion: string;
  profileVersions?: ProfileVersionSnapshot;
  issues: ValidationIssue[];
}

export const validationIssueSchema: z.ZodType<ValidationIssue> = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  source: z.enum([
    "geometry",
    "construction",
    "hardware",
    "manufacturing",
    "installation",
    "ai",
  ]),
  severity: z.enum(["info", "warning", "error", "blocking"]),

  roomId: z.string().optional(),
  cabinetId: z.string().optional(),
  partId: z.string().optional(),

  message: z.string().min(1),

  measuredValue: z.number().optional(),
  requiredValue: z.number().optional(),
  unit: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
});

export const validationReportV2Schema: z.ZodType<ValidationReportV2> = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  documentSchemaVersion: z.string(),
  profileVersions: z
    .object({
      construction: z.object({ id: z.string(), version: z.number().int().positive() }).optional(),
      material: z.object({ id: z.string(), version: z.number().int().positive() }).optional(),
      hardware: z.object({ id: z.string(), version: z.number().int().positive() }).optional(),
    })
    .optional(),
  issues: z.array(validationIssueSchema),
});

const SEVERITY_ORDER: ValidationSeverity[] = ["info", "warning", "error", "blocking"];

/**
 * Returns the highest-severity value present in the list, or `null` when
 * the list is empty. Callers use this to decide overall report status:
 * `"blocking"` prevents release for manufacturing.
 */
export function highestSeverity(issues: ValidationIssue[]): ValidationSeverity | null {
  let maxIdx = -1;
  for (const issue of issues) {
    const idx = SEVERITY_ORDER.indexOf(issue.severity);
    if (idx > maxIdx) maxIdx = idx;
  }
  return maxIdx === -1 ? null : SEVERITY_ORDER[maxIdx]!;
}

export function issuesBySource(
  issues: ValidationIssue[],
): Record<ValidationSource, ValidationIssue[]> {
  const buckets: Record<ValidationSource, ValidationIssue[]> = {
    geometry: [],
    construction: [],
    hardware: [],
    manufacturing: [],
    installation: [],
    ai: [],
  };
  for (const issue of issues) buckets[issue.source].push(issue);
  return buckets;
}

export function hasBlockingIssue(issues: ValidationIssue[]): boolean {
  for (const issue of issues) if (issue.severity === "blocking") return true;
  return false;
}
