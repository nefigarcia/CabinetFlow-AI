// Phase 2 semantic HardwareResolution.
//
// PURE. NO DB. NO SIDE EFFECTS.
//
// Given the effective HardwareProfile + resolved family/front/drawer
// system rows + cabinet parameters (doorCount, drawerCount, ...), this
// module emits a semantic HardwareRequirement[] alongside a list of
// Phase 2 readiness codes. The output does NOT drive the legacy BOM
// (`calculateHardwareBom`) — it is a parallel semantic layer consumed
// only by the Inspector.
//
// Freeze contract:
//   · `HARDWARE_TYPES` vocabulary is not extended by Phase 2.
//   · Hinge plates (which real Build Sheets track separately) are
//     preserved via category="other" + spec.unmodeledCategory="hinge_plate"
//     + a SYSTEM_CAPABILITY_DEFERRED readiness code.
//   · Soft close remains a legacy `HARDWARE_TYPES` category AND is
//     attributed on each hinge/slide requirement — the two layers
//     coexist by design.

import type { CabinetType } from "../../types/cabinet";
import type { HardwareProfileFields } from "../profiles/types";
import type {
  DrawerSystemRow,
  FrontSystemRow,
  HardwareRequirement,
  HardwareResolution,
  Phase2ReadinessCode,
} from "./types";

export interface HardwareResolutionInput {
  cabinetType: CabinetType;
  cabinetParams: Record<string, unknown> | null | undefined;

  frontSystem: FrontSystemRow | null;
  drawerSystem: DrawerSystemRow | null;

  effectiveHardware: Partial<HardwareProfileFields>;

  /** Optional: the resolved family rule. Available so future rules
   *  (e.g. tall-door hinge-count from cornerVariant) can consult it. */
  cabinetFamilyRule?: { cornerVariant: string | null } | null;
}

export interface HardwareResolutionOutput extends HardwareResolution {
  /** Warning-only readiness codes emitted alongside the resolution. */
  readiness: Array<{
    code: Phase2ReadinessCode;
    detail: string;
  }>;
}

function readNumber(
  params: Record<string, unknown> | null | undefined,
  key: string,
): number {
  if (!params) return 0;
  const v = params[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Resolves the semantic HardwareRequirement list for a cabinet.
 *
 * This is Phase 2 semantic-only. It never mutates cabinet data, never
 * writes to the DB, and never influences the legacy BOM. The Inspector
 * reads this output for the Systems section.
 */
export function resolveHardwareRequirements(
  input: HardwareResolutionInput,
): HardwareResolutionOutput {
  const requirements: HardwareRequirement[] = [];
  const readiness: HardwareResolutionOutput["readiness"] = [];

  // Blind-corner cabinets: defer hardware entirely — real Build Sheet
  // evidence for blind-corner hinging is not available today.
  if (input.cabinetFamilyRule && (
    input.cabinetFamilyRule.cornerVariant === "blind_left" ||
    input.cabinetFamilyRule.cornerVariant === "blind_right"
  )) {
    return {
      requirements: [],
      deferred: true,
      deferReason: "blind_corner_hardware_deferred",
      readiness: [],
    };
  }

  const familyHintHinge = input.effectiveHardware.hingeManufacturer ?? null;
  const familyHintSlide = input.effectiveHardware.drawerSlideManufacturer ?? null;
  const softCloseHinge = input.effectiveHardware.hingeSoftClose === true ? true : undefined;
  const softCloseSlide = input.effectiveHardware.drawerSlideSoftClose === true ? true : undefined;

  const doorCount   = readNumber(input.cabinetParams, "doorCount");
  const drawerCount = readNumber(input.cabinetParams, "drawerCount");

  // ─── Hinge / handle for hinged front kinds ────────────────────────────
  const hasHingedFront =
    input.frontSystem !== null &&
    (input.frontSystem.kind === "hinged_single" ||
      input.frontSystem.kind === "hinged_double");

  if (doorCount > 0) {
    if (hasHingedFront) {
      // 2 hinges per door — Bearnson standard. Higher counts for tall
      // doors are UNRESOLVED at the shop-wide level (no verified rule).
      requirements.push({
        category: "hinge",
        familyHint: familyHintHinge,
        quantity: doorCount * 2,
        unit: "piece",
        quantityStatus: "verified",
        requirements: softCloseHinge ? { softClose: true } : {},
        spec: {},
        provenance: {
          source: "system",
          detail: `${doorCount * 2} hinge(s) — 2 per hinged door (${input.frontSystem?.kind ?? "hinged"})`,
        },
      });
      // Real Build Sheets list hinge plates separately; Phase 2 catalog
      // has no hinge_plate category. Preserve semantically via "other".
      requirements.push({
        category: "other",
        familyHint: familyHintHinge,
        quantity: doorCount * 2,
        unit: "piece",
        quantityStatus: "verified",
        requirements: {},
        spec: {
          unmodeledCategory: "hinge_plate",
        },
        provenance: {
          source: "system",
          detail: `${doorCount * 2} hinge plate(s) — Phase 2 catalog does not model hinge_plate as a first-class category`,
        },
      });
      readiness.push({
        code: "SYSTEM_CAPABILITY_DEFERRED",
        detail:
          "hinge_plate — Phase 2 catalog does not model hinge plates as a first-class category. Semantic requirement preserved via spec.unmodeledCategory.",
      });

      // Handles — 1 per door.
      requirements.push({
        category: "handle",
        familyHint: null,
        quantity: doorCount,
        unit: "piece",
        quantityStatus: "verified",
        requirements: {},
        spec: {},
        provenance: {
          source: "system",
          detail: `${doorCount} handle(s) — 1 per door`,
        },
      });
    } else {
      // Non-hinged front OR no front system resolved: hinge quantity is
      // unresolved (do NOT fabricate a count).
      requirements.push({
        category: "hinge",
        familyHint: familyHintHinge,
        quantity: 0,
        unit: "piece",
        quantityStatus: "unresolved",
        requirements: softCloseHinge ? { softClose: true } : {},
        spec: {},
        provenance: {
          source: "default",
          detail: input.frontSystem
            ? `Front kind '${input.frontSystem.kind}' does not use hinges — count unresolved.`
            : "No front system resolved — hinge quantity unresolved.",
        },
      });
      readiness.push({
        code: "HARDWARE_QUANTITY_UNRESOLVED",
        detail: "hinge quantity unresolved (front system missing or non-hinged)",
      });
    }
  }

  // ─── Drawer slides / handles ─────────────────────────────────────────
  if (drawerCount > 0) {
    const isProprietary = input.drawerSystem?.kind === "proprietary";
    const proprietaryFamily = isProprietary
      ? input.drawerSystem?.proprietaryFamily ?? null
      : null;

    // Preserve source-wording: real Build Sheets phrase drawer guides
    // as "4 P" (pairs). Our semantic unit reflects that. Do NOT expand.
    requirements.push({
      category: "drawer_slide",
      familyHint: proprietaryFamily ?? familyHintSlide,
      quantity: drawerCount,
      unit: "pair",
      quantityStatus: "verified",
      requirements: softCloseSlide ? { softClose: true } : {},
      spec: proprietaryFamily
        ? { proprietaryFamily }
        : {},
      provenance: {
        source: "system",
        detail: `${drawerCount} drawer slide(s) — 1 pair per drawer${proprietaryFamily ? ` (${proprietaryFamily})` : ""}`,
      },
    });

    // Handles — 1 per drawer.
    requirements.push({
      category: "handle",
      familyHint: null,
      quantity: drawerCount,
      unit: "piece",
      quantityStatus: "verified",
      requirements: {},
      spec: {},
      provenance: {
        source: "system",
        detail: `${drawerCount} handle(s) — 1 per drawer`,
      },
    });
  }

  return {
    requirements,
    deferred: false,
    readiness,
  };
}
