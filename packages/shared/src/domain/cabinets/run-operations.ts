import type { Cabinet } from "../../types/cabinet";
import type { WallDefinition } from "../architecture/types";
import { getWallLengthMm } from "../architecture/wall-math";
import type { CabinetRun, CabinetRunItem } from "./cabinet-run";
import { sortRunItems, EXACT_TOL_MM, FILLER_MAX_MM } from "./cabinet-run";
import type { CabinetWallPlacement } from "./wall-placement";
import { defaultBaseElevationMm } from "./wall-placement";

// Pure run-layout operations.
//
// Every operation returns FRESH placement values — it never mutates a
// Cabinet or a run. The web layer wraps these in optimistic store
// updates + PATCH requests.
//
// Deterministic. AI never calls these directly; AI proposes intent, this
// module computes exact offsets.

export interface RunAppendResult {
  /** New cabinet placement, wall-attached. */
  placement: CabinetWallPlacement;
  /** True if the append fits within the wall length; false when the
   *  computed placement would extend past the wall end. Callers can
   *  still commit the placement — the layout validator will flag the
   *  overflow — but usually surface a warning first. */
  fitsWithinWall: boolean;
}

/** Appends a NEW cabinet at the RIGHT end of the run (chained). If the
 *  run is empty, starts at offset 0. */
export function chainAppendRight(input: {
  run: CabinetRun;
  newCabinetWidthMm: number;
  newCabinetType: Cabinet["type"];
  wall: WallDefinition;
}): RunAppendResult {
  const lastRightEdge =
    input.run.items.length > 0
      ? input.run.items[input.run.items.length - 1]!.rightEdgeMm
      : 0;
  const wallLen = getWallLengthMm(input.wall);
  const placement: CabinetWallPlacement = {
    wallId: input.wall.id,
    offsetMm: lastRightEdge,
    baseElevationMm: defaultBaseElevationMm(input.newCabinetType),
    facing: "into-room",
  };
  return {
    placement,
    fitsWithinWall: lastRightEdge + input.newCabinetWidthMm <= wallLen + EXACT_TOL_MM,
  };
}

/** Prepends a NEW cabinet at the LEFT end of the run. If the resulting
 *  offset would be negative, the operation shifts every existing cabinet
 *  RIGHT by the required amount so the new cabinet's left edge lands at
 *  offset = 0 (avoids negative offsets in persisted state). */
export function chainAppendLeft(input: {
  run: CabinetRun;
  newCabinetWidthMm: number;
  newCabinetType: Cabinet["type"];
  wall: WallDefinition;
}): {
  placement: CabinetWallPlacement;
  /** Shift applied to existing cabinets (0 when the new cabinet fits
   *  without pushing others). Callers must apply this shift by PATCHing
   *  every existing cabinet's offsetMm += shiftMm. */
  shiftMm: number;
  fitsWithinWall: boolean;
} {
  const firstOffset =
    input.run.items.length > 0 ? input.run.items[0]!.placement.offsetMm : 0;
  const newLeftIfNoShift = firstOffset - input.newCabinetWidthMm;
  const shiftMm = newLeftIfNoShift < 0 ? -newLeftIfNoShift : 0;
  const newOffset = newLeftIfNoShift + shiftMm;
  const wallLen = getWallLengthMm(input.wall);
  const totalRight =
    (input.run.items.length > 0
      ? input.run.items[input.run.items.length - 1]!.rightEdgeMm
      : newOffset + input.newCabinetWidthMm) + shiftMm;
  return {
    placement: {
      wallId: input.wall.id,
      offsetMm: newOffset,
      baseElevationMm: defaultBaseElevationMm(input.newCabinetType),
      facing: "into-room",
    },
    shiftMm,
    fitsWithinWall: totalRight <= wallLen + EXACT_TOL_MM,
  };
}

// ─── Insert between two cabinets ────────────────────────────────────────

export interface InsertResult {
  ok: boolean;
  reason?: "insufficient-space";
  /** New cabinet placement. Only set when ok=true. */
  placement?: CabinetWallPlacement;
  /** Downstream cabinets (those AFTER `beforeCabinetId`) that must shift
   *  right to make room. Empty when the existing gap is large enough. */
  shifts?: { cabinetId: string; newOffsetMm: number }[];
}

/**
 * Inserts a NEW cabinet AFTER `beforeCabinetId` in the run. Behavior:
 *   · If the gap between `beforeCabinet.rightEdge` and the next
 *     cabinet's left edge is ≥ newCabinetWidth, place at rightEdge and
 *     no shifts are needed.
 *   · Otherwise, shift every cabinet from `beforeCabinet+1` onward by
 *     the deficit — as long as the tail cabinet still fits within the
 *     wall length. If it doesn't, return { ok:false, reason }.
 *   · When `beforeCabinetId` is null / not found, behaves like
 *     chainAppendRight.
 */
export function insertAfter(input: {
  run: CabinetRun;
  newCabinetWidthMm: number;
  newCabinetType: Cabinet["type"];
  wall: WallDefinition;
  beforeCabinetId: string | null;
}): InsertResult {
  const items = input.run.items;
  const wallLen = getWallLengthMm(input.wall);
  if (input.beforeCabinetId == null) {
    const append = chainAppendRight({
      run: input.run,
      newCabinetWidthMm: input.newCabinetWidthMm,
      newCabinetType: input.newCabinetType,
      wall: input.wall,
    });
    if (!append.fitsWithinWall) return { ok: false, reason: "insufficient-space" };
    return { ok: true, placement: append.placement, shifts: [] };
  }
  const idx = items.findIndex((it) => it.cabinetId === input.beforeCabinetId);
  if (idx < 0) {
    const append = chainAppendRight({
      run: input.run,
      newCabinetWidthMm: input.newCabinetWidthMm,
      newCabinetType: input.newCabinetType,
      wall: input.wall,
    });
    if (!append.fitsWithinWall) return { ok: false, reason: "insufficient-space" };
    return { ok: true, placement: append.placement, shifts: [] };
  }
  const before = items[idx]!;
  const startOffset = before.rightEdgeMm;
  const next = items[idx + 1];
  if (!next) {
    // Inserting at the tail is the same as chainAppendRight (but based on
    // a specific anchor rather than the whole run's last edge — equivalent
    // when `before` IS the last item).
    if (startOffset + input.newCabinetWidthMm > wallLen + EXACT_TOL_MM) {
      return { ok: false, reason: "insufficient-space" };
    }
    return {
      ok: true,
      placement: {
        wallId: input.wall.id,
        offsetMm: startOffset,
        baseElevationMm: defaultBaseElevationMm(input.newCabinetType),
        facing: "into-room",
      },
      shifts: [],
    };
  }
  const existingGap = next.placement.offsetMm - startOffset;
  const deficit = input.newCabinetWidthMm - existingGap;
  if (deficit <= EXACT_TOL_MM) {
    // Existing gap is big enough — no shift required.
    return {
      ok: true,
      placement: {
        wallId: input.wall.id,
        offsetMm: startOffset,
        baseElevationMm: defaultBaseElevationMm(input.newCabinetType),
        facing: "into-room",
      },
      shifts: [],
    };
  }
  // Need to shift downstream cabinets by `deficit`. Check the tail fits.
  const lastRight = items[items.length - 1]!.rightEdgeMm + deficit;
  if (lastRight > wallLen + EXACT_TOL_MM) {
    return { ok: false, reason: "insufficient-space" };
  }
  const shifts: { cabinetId: string; newOffsetMm: number }[] = [];
  for (let i = idx + 1; i < items.length; i++) {
    shifts.push({
      cabinetId: items[i]!.cabinetId,
      newOffsetMm: items[i]!.placement.offsetMm + deficit,
    });
  }
  return {
    ok: true,
    placement: {
      wallId: input.wall.id,
      offsetMm: startOffset,
      baseElevationMm: defaultBaseElevationMm(input.newCabinetType),
      facing: "into-room",
    },
    shifts,
  };
}

// ─── Move / reorder ─────────────────────────────────────────────────────

/** Moves a cabinet to a new wall-local offset, clamping so the cabinet's
 *  right edge stays within [0, wallLength]. Returns the new offset. */
export function moveCabinetToOffset(input: {
  run: CabinetRun;
  cabinetId: string;
  targetOffsetMm: number;
  wall: WallDefinition;
}): number {
  const item = input.run.items.find((it) => it.cabinetId === input.cabinetId);
  if (!item) return input.targetOffsetMm;
  const w = Number(item.cabinet.width);
  const wallLen = getWallLengthMm(input.wall);
  return Math.max(0, Math.min(wallLen - w, input.targetOffsetMm));
}

/** Reorders `cabinetId` to a new index in the run, RESPACING everyone by
 *  a chain layout (offsets recomputed from 0 with no gaps). Preserves
 *  cabinet widths. Returns the full patch set. */
export function reorderRunTight(input: {
  run: CabinetRun;
  cabinetId: string;
  toIndex: number;
}): { cabinetId: string; newOffsetMm: number }[] {
  const items = sortRunItems(input.run.items);
  const fromIndex = items.findIndex((it) => it.cabinetId === input.cabinetId);
  if (fromIndex < 0) return [];
  const clampedTo = Math.max(0, Math.min(items.length - 1, input.toIndex));
  const moving = items[fromIndex]!;
  const rest = items.filter((_, i) => i !== fromIndex);
  const nextArr = [...rest.slice(0, clampedTo), moving, ...rest.slice(clampedTo)];
  const patches: { cabinetId: string; newOffsetMm: number }[] = [];
  let offset = 0;
  for (const it of nextArr) {
    if (it.placement.offsetMm !== offset) {
      patches.push({ cabinetId: it.cabinetId, newOffsetMm: offset });
    }
    offset += Number(it.cabinet.width);
  }
  return patches;
}

// ─── Distribute ─────────────────────────────────────────────────────────

export type DistributeStrategy = "equal-gaps" | "filler-at-ends";

/**
 * Distributes cabinets across the wall's usable span. Never changes
 * cabinet widths — either it spaces gaps evenly ("equal-gaps") or it
 * concentrates all slack at the two ends ("filler-at-ends"). Returns a
 * patch set.
 *
 * `usableSpanMm` defaults to the wall length. Callers pass a smaller
 * value when architectural openings / appliances consume part of the
 * wall (compute it via `getRemainingWallSpace`).
 */
export function distributeRun(input: {
  run: CabinetRun;
  wall: WallDefinition;
  strategy: DistributeStrategy;
  usableSpanMm?: number;
}): { cabinetId: string; newOffsetMm: number }[] {
  const items = sortRunItems(input.run.items);
  if (items.length === 0) return [];
  const wallLen = getWallLengthMm(input.wall);
  const span = input.usableSpanMm ?? wallLen;
  const cabinetsWidth = items.reduce((s, it) => s + Number(it.cabinet.width), 0);
  const slack = span - cabinetsWidth;
  if (slack < -EXACT_TOL_MM) {
    // Overflow — nothing to distribute; return an empty patch and let
    // validation flag the overshoot.
    return [];
  }
  const patches: { cabinetId: string; newOffsetMm: number }[] = [];
  if (input.strategy === "equal-gaps") {
    // n+1 gaps for n cabinets — one at each end + between each pair.
    const gap = slack / (items.length + 1);
    let cursor = gap;
    for (const it of items) {
      if (it.placement.offsetMm !== cursor) {
        patches.push({ cabinetId: it.cabinetId, newOffsetMm: cursor });
      }
      cursor += Number(it.cabinet.width) + gap;
    }
  } else {
    // filler-at-ends: half of slack at each end, cabinets tight in the middle.
    const halfSlack = slack / 2;
    let cursor = halfSlack;
    for (const it of items) {
      if (it.placement.offsetMm !== cursor) {
        patches.push({ cabinetId: it.cabinetId, newOffsetMm: cursor });
      }
      cursor += Number(it.cabinet.width);
    }
  }
  return patches;
}

// ─── Fit Run ────────────────────────────────────────────────────────────

export interface FitRunReport {
  requiredMm: number;
  availableMm: number;
  deltaMm: number; // + means slack, - means overflow
  suggestions: FitRunSuggestion[];
}

export interface FitRunSuggestion {
  kind: "add-filler" | "distribute-equal" | "resize-cabinet";
  labelMm: number;
  targetCabinetId?: string;
}

/** Reports the delta between required and available wall span and offers
 *  deterministic suggestions. Never modifies cabinets — the caller picks
 *  a suggestion + calls the appropriate primitive. */
export function fitRunReport(input: {
  run: CabinetRun;
  usableSpanMm: number;
  /** If the caller wants to nominate a "flexible" cabinet whose width
   *  can absorb slack, pass its id here so the report includes a
   *  targeted resize suggestion. */
  flexibleCabinetId?: string;
}): FitRunReport {
  const requiredMm = input.run.items.reduce(
    (s, it) => s + Number(it.cabinet.width),
    0,
  );
  const deltaMm = input.usableSpanMm - requiredMm;
  const suggestions: FitRunSuggestion[] = [];
  if (deltaMm > EXACT_TOL_MM) {
    if (deltaMm <= FILLER_MAX_MM) {
      suggestions.push({ kind: "add-filler", labelMm: deltaMm });
    } else {
      suggestions.push({ kind: "distribute-equal", labelMm: deltaMm });
    }
    if (input.flexibleCabinetId) {
      const flex = input.run.items.find((it) => it.cabinetId === input.flexibleCabinetId);
      if (flex) {
        suggestions.push({
          kind: "resize-cabinet",
          labelMm: Number(flex.cabinet.width) + deltaMm,
          targetCabinetId: flex.cabinetId,
        });
      }
    }
  } else if (deltaMm < -EXACT_TOL_MM) {
    // Overflow: suggest shrinking the flexible cabinet if provided.
    if (input.flexibleCabinetId) {
      const flex = input.run.items.find((it) => it.cabinetId === input.flexibleCabinetId);
      if (flex) {
        const newW = Math.max(150, Number(flex.cabinet.width) + deltaMm);
        suggestions.push({
          kind: "resize-cabinet",
          labelMm: newW,
          targetCabinetId: flex.cabinetId,
        });
      }
    }
  }
  return { requiredMm, availableMm: input.usableSpanMm, deltaMm, suggestions };
}
