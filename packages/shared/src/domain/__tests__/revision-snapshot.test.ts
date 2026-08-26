import { describe, expect, it } from "vitest";
import {
  snapshotPartToPrismaData,
  type LegacySnapshotPart,
} from "../adapters/revision-snapshot";

// These tests lock the legacy revision-restore mapping used by
// apps/api/src/app/api/projects/[id]/revisions/[revisionId]/restore/route.ts.
// If any assertion here breaks, the API route MUST be reviewed for
// production data loss risk before landing the change.

function makeSnapshotPart(
  overrides: Partial<LegacySnapshotPart> = {},
): LegacySnapshotPart {
  return {
    name: "left_panel",
    partType: "left_panel",
    width: 580,
    height: 720,
    thickness: 18,
    quantity: 1,
    materialId: null,
    grainDir: null,
    edgeBanding: null,
    cutParams: null,
    ...overrides,
  };
}

describe("snapshotPartToPrismaData — legacy revision restore mapping", () => {
  it("preserves isManual=true from a manual-part snapshot", () => {
    const snap = makeSnapshotPart({
      name: "Custom Filler Panel",
      partType: "custom",
      isManual: true,
    });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.isManual).toBe(true);
  });

  it("preserves isManual=false from a generated-part snapshot", () => {
    const snap = makeSnapshotPart({ isManual: false });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.isManual).toBe(false);
  });

  it("defaults isManual to false for a historical snapshot missing the field", () => {
    // Pre-V2.1A.1 snapshots may have been captured before Prisma reliably
    // included isManual. Missing → false (matches pre-fix restore behavior).
    const snap = makeSnapshotPart(); // isManual undefined
    expect(snap.isManual).toBeUndefined();
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.isManual).toBe(false);
  });

  it("propagates orgId onto the create input", () => {
    const data = snapshotPartToPrismaData(makeSnapshotPart(), "org_xyz");
    expect(data.orgId).toBe("org_xyz");
  });

  it("carries through width/height/thickness/quantity verbatim", () => {
    const snap = makeSnapshotPart({
      width: 12.34,
      height: 56.78,
      thickness: 18,
      quantity: 3,
    });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.width).toBe(12.34);
    expect(data.height).toBe(56.78);
    expect(data.thickness).toBe(18);
    expect(data.quantity).toBe(3);
  });

  it("omits materialId when the snapshot value is null", () => {
    const snap = makeSnapshotPart({ materialId: null });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.materialId).toBeUndefined();
  });

  it("emits materialId when the snapshot value is a string", () => {
    const snap = makeSnapshotPart({ materialId: "mat_123" });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.materialId).toBe("mat_123");
  });

  it("preserves grainDir, edgeBanding, cutParams when present", () => {
    const snap = makeSnapshotPart({
      grainDir: "vertical",
      edgeBanding: { top: true, bottom: false, left: true, right: true },
      cutParams: { note: "legacy joinery" },
    });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.grainDir).toBe("vertical");
    expect(data.edgeBanding).toEqual({
      top: true,
      bottom: false,
      left: true,
      right: true,
    });
    expect(data.cutParams).toEqual({ note: "legacy joinery" });
  });

  it("preserves assemblyGroup when present in the snapshot", () => {
    const snap = makeSnapshotPart({ assemblyGroup: "carcass" });
    const data = snapshotPartToPrismaData(snap, "org_1");
    expect(data.assemblyGroup).toBe("carcass");
  });

  it("does NOT introduce V2 PartGenerationMode fields", () => {
    const data = snapshotPartToPrismaData(makeSnapshotPart(), "org_1");
    expect(data).not.toHaveProperty("generationMode");
  });

  it("simulates full restore round-trip: snapshot -> restore -> snapshot preserves isManual", () => {
    // Simulate a snapshot round-trip: capture, JSON serialise, restore,
    // and re-capture. Manual parts must never silently downgrade.
    const originalParts: LegacySnapshotPart[] = [
      makeSnapshotPart({ name: "Left", isManual: false }),
      makeSnapshotPart({ name: "Right", isManual: false }),
      makeSnapshotPart({
        name: "Custom filler",
        partType: "custom",
        isManual: true,
      }),
    ];
    const serialised = JSON.parse(
      JSON.stringify(originalParts),
    ) as LegacySnapshotPart[];
    const restoreInputs = serialised.map((p) =>
      snapshotPartToPrismaData(p, "org_1"),
    );
    expect(restoreInputs.map((p) => p.isManual)).toEqual([false, false, true]);
  });
});
