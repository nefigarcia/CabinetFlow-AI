import type { Cabinet, CabinetParameters } from "../../types/cabinet";

// Semantic interior intent for cabinets.
//
// Rather than manipulating manufacturing parts directly, the UI expresses
// intent — "3 drawer bank", "2 adjustable shelves", "double doors" — and
// the existing geometry compiler (packages/shared/src/types/geometry.ts)
// resolves those into physical parts. This module is a THIN read/patch
// adapter over `Cabinet.parameters` so the existing compiler continues
// to work unchanged.
//
// Manufacturing-regression safety: this file NEVER computes actual part
// dimensions. It only expresses intent as parameter values the compiler
// already understands (`drawerCount`, `shelfCount`, `doorCount`).

// ─── Drawer banks ───────────────────────────────────────────────────────

export type DrawerHeightPattern = "equal" | "top-small";

export interface DrawerBankIntent {
  /** Number of drawer fronts stacked in this bank. 1..8 typical. */
  count: number;
  /** How front heights are distributed. */
  heightPattern: DrawerHeightPattern;
}

export function readDrawerBankIntent(
  cabinet: Pick<Cabinet, "parameters" | "type">,
): DrawerBankIntent {
  const p = cabinet.parameters ?? {};
  const count = numberish(p.drawerCount) ?? (cabinet.type === "drawer_base" ? 4 : 0);
  const heightPattern = readHeightPattern(p);
  return { count, heightPattern };
}

/** Merges drawer bank intent into a parameters bag. Idempotent. */
export function withDrawerBankIntent(
  parameters: CabinetParameters | undefined,
  intent: Partial<DrawerBankIntent>,
): CabinetParameters {
  const base: Record<string, unknown> = { ...(parameters ?? {}) };
  if (intent.count !== undefined) base.drawerCount = Math.max(0, Math.floor(intent.count));
  if (intent.heightPattern !== undefined) base.drawerHeightPattern = intent.heightPattern;
  return base as CabinetParameters;
}

function readHeightPattern(p: CabinetParameters): DrawerHeightPattern {
  const raw = p.drawerHeightPattern;
  return raw === "top-small" ? "top-small" : "equal";
}

// ─── Shelves ────────────────────────────────────────────────────────────

export type ShelfPolicy = "adjustable" | "fixed";

export interface ShelfIntent {
  /** Total shelf count. Excludes the top / bottom carcass panels. */
  count: number;
  policy: ShelfPolicy;
}

export function readShelfIntent(
  cabinet: Pick<Cabinet, "parameters" | "type">,
): ShelfIntent {
  const p = cabinet.parameters ?? {};
  const rawCount = numberish(p.shelfCount);
  const defaultCount =
    cabinet.type === "wall" ? 2 : cabinet.type === "tall" ? 4 : 1;
  const count = rawCount ?? defaultCount;
  const policy: ShelfPolicy = p.shelfPolicy === "fixed" ? "fixed" : "adjustable";
  return { count, policy };
}

export function withShelfIntent(
  parameters: CabinetParameters | undefined,
  intent: Partial<ShelfIntent>,
): CabinetParameters {
  const base: Record<string, unknown> = { ...(parameters ?? {}) };
  if (intent.count !== undefined) base.shelfCount = Math.max(0, Math.floor(intent.count));
  if (intent.policy !== undefined) base.shelfPolicy = intent.policy;
  return base as CabinetParameters;
}

// ─── Doors ──────────────────────────────────────────────────────────────

export type DoorConfig = "none" | "single" | "double";

export function readDoorConfig(cabinet: Pick<Cabinet, "parameters">): DoorConfig {
  const raw = numberish(cabinet.parameters?.doorCount);
  if (raw === 0) return "none";
  if (raw === 1) return "single";
  return "double";
}

export function withDoorConfig(
  parameters: CabinetParameters | undefined,
  config: DoorConfig,
): CabinetParameters {
  const base: Record<string, unknown> = { ...(parameters ?? {}) };
  base.doorCount = config === "none" ? 0 : config === "single" ? 1 : 2;
  return base as CabinetParameters;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function numberish(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
