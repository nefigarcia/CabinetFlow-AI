// Legacy revision-snapshot adapter (V2.1A.1).
//
// Revision snapshots are stored as opaque JSON blobs in Prisma:
// `Revision.snapshot` (see packages/db/prisma/schema.prisma). The current
// on-write path captures every column of `CabinetPart` via a Prisma
// `include: { parts: true }`, which naturally includes `isManual`. The
// on-read (restore) path used to DROP `isManual`, silently downgrading
// manual parts to generated ones on every restore.
//
// This adapter is the SOURCE OF TRUTH for that mapping. It:
//
//   1. Documents the SnapshotPart shape (both current and pre-V2.1A.1).
//   2. Provides a pure `snapshotPartToPrismaData` function that preserves
//      `isManual` when present and defaults to `false` for legacy
//      snapshots that predate the fix.
//   3. Is unit-testable independently of Prisma / the API layer.
//
// DO NOT introduce V2 PartGenerationMode fields here. Snapshot shape
// evolution belongs in a bumped documentSchemaVersion at V2.5.

/**
 * The current snapshot part shape. The `isManual` field was silently
 * captured before V2.1A.1 (Prisma include: true grabs every column) but
 * never READ by the restore path. Legacy snapshots created before that
 * fix may not have it at all — treat as `false` for backwards compat.
 */
export interface LegacySnapshotPart {
  name: string;
  partType: string;
  width: number;
  height: number;
  thickness: number;
  quantity: number;
  materialId: string | null;
  grainDir: string | null;
  edgeBanding: unknown;
  cutParams: unknown;
  /** Optional to tolerate historical snapshots that predate V2.1A.1. */
  isManual?: boolean;
  /** Optional — legacy snapshots didn't always include this column. */
  assemblyGroup?: string | null;
}

/**
 * The Prisma create-input shape for a CabinetPart. Kept structural (not
 * imported from Prisma types) so this module has zero Prisma dependency
 * and can be freely tested from packages/shared.
 */
export interface PartCreateInput {
  orgId: string;
  name: string;
  partType: string;
  width: number;
  height: number;
  thickness: number;
  quantity: number;
  materialId?: string;
  grainDir?: string;
  edgeBanding?: unknown;
  cutParams?: unknown;
  assemblyGroup?: string;
  isManual: boolean;
}

/**
 * Maps a legacy snapshot part into the Prisma create data used by the
 * revision restore endpoint.
 *
 * Legacy semantics ONLY:
 *   - `snapshot.isManual === true`  → recreated with isManual=true
 *   - `snapshot.isManual === false` → recreated with isManual=false
 *   - `snapshot.isManual` missing   → defaults to false (matches pre-fix
 *                                     behavior for historical snapshots)
 *
 * This function MUST NOT introduce V2 generation-mode semantics. See the
 * module-level comment for why.
 */
export function snapshotPartToPrismaData(
  snapshotPart: LegacySnapshotPart,
  orgId: string,
): PartCreateInput {
  const out: PartCreateInput = {
    orgId,
    name: snapshotPart.name,
    partType: snapshotPart.partType,
    width: snapshotPart.width,
    height: snapshotPart.height,
    thickness: snapshotPart.thickness,
    quantity: snapshotPart.quantity,
    isManual: snapshotPart.isManual ?? false,
  };
  if (snapshotPart.materialId != null) out.materialId = snapshotPart.materialId;
  if (snapshotPart.grainDir != null) out.grainDir = snapshotPart.grainDir;
  if (snapshotPart.edgeBanding != null) out.edgeBanding = snapshotPart.edgeBanding;
  if (snapshotPart.cutParams != null) out.cutParams = snapshotPart.cutParams;
  if (snapshotPart.assemblyGroup != null) out.assemblyGroup = snapshotPart.assemblyGroup;
  return out;
}
