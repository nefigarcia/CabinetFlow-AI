// Phase 3.0 — Cabinet Interior Components (typed intent).
//
// Semantic layer: expresses WHAT interior functionality a cabinet
// contains, without specifying CNC geometry / hardware BOM / part
// dimensions. Manufacturing wiring is DELIBERATELY deferred to a later
// Phase 3.x, one component type at a time.
//
// Storage: Cabinet.parameters.interiorComponents (JSON array). No new
// Prisma column. Coexists with legacy manufacturing intent
// (doorCount / drawerCount / shelfCount / DrawerBankIntent / ShelfIntent
// / DoorConfig) — legacy fields remain authoritative for geometry.
//
// Every component MUST have a stable `id` (client-generated via
// crypto.randomUUID at add time — never derived from array position)
// so reorder / edit / disable / revision restore all preserve identity.

// ─── Component base ─────────────────────────────────────────────────

export const INTERIOR_COMPONENT_TYPES = [
  "rollout",
  "trash_pullout",
  "tray_divider",
  "spice_rack",
  "knife_organizer",
  "utensil_divider",
  "drawer_divider",
  "hidden_drawer",
  "sink_pullout",
  "sponge_tilt_out",
  "custom",
] as const;
export type InteriorComponentType = (typeof INTERIOR_COMPONENT_TYPES)[number];

/** Verification vocabulary is shared with the Phase 1/2 profile stack —
 *  duplicated here so consumers don't need to reach into another module. */
export const INTERIOR_COMPONENT_VERIFICATION_STATUSES = [
  "verified",
  "partially_verified",
  "project_specific",
  "unverified",
] as const;
export type InteriorComponentVerificationStatus =
  (typeof INTERIOR_COMPONENT_VERIFICATION_STATUSES)[number];

// ─── Target model ────────────────────────────────────────────────────
//
// Phase 3.0 uses index-based targeting because the repo does not yet
// have per-drawer / per-door / per-shelf stable IDs. `index` is
// 0-based internally; UI labels are 1-based ("Drawer 1"). Never
// silently retarget when a count decreases — the component keeps its
// target and emits INTERIOR_COMPONENT_TARGET_UNRESOLVED readiness.
//
// The `opening.slotId` variant discussed in the design packet is
// intentionally NOT part of the MVP union — there is no persisted
// stable opening identity in the current codebase.

export type InteriorComponentTarget =
  | { kind: "cabinet" }
  | { kind: "drawer"; index: number }
  | { kind: "door"; index: number }
  | { kind: "shelf"; index: number };

export const INTERIOR_TARGET_KINDS = ["cabinet", "drawer", "door", "shelf"] as const;
export type InteriorTargetKind = (typeof INTERIOR_TARGET_KINDS)[number];

// ─── Per-type field extensions ──────────────────────────────────────
//
// Only fields evidenced by Bibb / Klint / Hawkes docs (or clearly
// required by the semantic type) are included. Everything else is
// optional. Unknown ≠ zero — the compat engine emits
// TARGET_UNRESOLVED / INCOMPATIBLE rather than fabricating a value.

interface InteriorComponentBase {
  id: string;                                 // stable — crypto.randomUUID at create
  enabled: boolean;                           // default true; user may disable without removing
  label?: string;                             // display override
  notes?: string;                             // free-form
  target?: InteriorComponentTarget;
  verificationStatus?: InteriorComponentVerificationStatus;
  sourceRef?: string;                         // e.g. "Bibb Cabinetry Layouts 8_24_26 x2.pdf — page 12"
  metadata?: Record<string, unknown>;         // deferred capabilities, extensibility
  /** Standalone components never carry a definition link. Linked
   *  components are modeled by `LinkedInteriorComponent` below. */
  definitionId?: undefined;
}

export interface RolloutComponent extends InteriorComponentBase {
  type: "rollout";
  /** Optional. If unknown, leave unset — do NOT default to 1. */
  quantity?: number;
  /** Bibb: "Pull out with open sides" — evidenced as boolean. */
  openSides?: boolean;
}

export interface TrashPulloutComponent extends InteriorComponentBase {
  type: "trash_pullout";
  /** Bibb: "DBL 35 Qt Trash" → bins=2. Required — the concept is
   *  meaningless without a bin count. */
  bins: number;
  /** e.g. 35 for "35 Qt Trash". */
  nominalBinSizeQt?: number;
  configuration?: "single" | "double" | "triple";
}

export interface TrayDividerComponent extends InteriorComponentBase {
  type: "tray_divider";
  /** Slot count if evidenced; otherwise unset. */
  quantity?: number;
}

export interface SpiceRackComponent extends InteriorComponentBase {
  type: "spice_rack";
  location?: "door" | "interior" | "pullout";
}

export interface KnifeOrganizerComponent extends InteriorComponentBase {
  type: "knife_organizer";
  // No additional fields required by Bibb evidence today.
}

export interface UtensilDividerComponent extends InteriorComponentBase {
  type: "utensil_divider";
  removable?: boolean;
}

export interface DrawerDividerComponent extends InteriorComponentBase {
  type: "drawer_divider";
  orientation?: "vertical" | "horizontal" | "grid";
  removable?: boolean;
  count?: number;
}

export interface HiddenDrawerComponent extends InteriorComponentBase {
  type: "hidden_drawer";
  location?: "above_drawer" | "inside_cabinet" | "above_trash" | "custom";
}

export interface SinkPulloutComponent extends InteriorComponentBase {
  type: "sink_pullout";
  quantity?: number;
}

export interface SpongeTiltOutComponent extends InteriorComponentBase {
  type: "sponge_tilt_out";
  quantity?: number;
}

/** Escape hatch for shop-specific items not yet formalized. `label` is
 *  required — a "custom" component without a label is meaningless. */
export interface CustomInteriorComponent extends InteriorComponentBase {
  type: "custom";
  label: string;
  spec?: Record<string, unknown>;
}

/** Phase 3.0 contract — a component that carries all of its own
 *  semantic configuration (no shop-standard link). */
export type StandaloneInteriorComponent =
  | RolloutComponent
  | TrashPulloutComponent
  | TrayDividerComponent
  | SpiceRackComponent
  | KnifeOrganizerComponent
  | UtensilDividerComponent
  | DrawerDividerComponent
  | HiddenDrawerComponent
  | SinkPulloutComponent
  | SpongeTiltOutComponent
  | CustomInteriorComponent;

// ─── Linked components (Phase 3.1a — forward compatibility ONLY) ────
//
// Phase 3.1b will let a component reference an immutable, org-scoped
// AccessoryDefinition row via `definitionId`. A linked component stores
// only OVERRIDES — every type-specific config field becomes optional
// (the definition carries the defaults), and `label` is optional even
// for `custom` (the definition name is the fallback display label).
//
// Phase 3.1a has NO definition table. This type exists so that 3.1a
// code, when used as a rollback target from 3.1b, can READ linked
// components without treating the whole array as corrupt. 3.1a never
// allows a definitionId to be created or changed — see
// `server-validation.ts` (enforceInteriorComponentsWritePolicy).

type InteriorConfigKeys<T> = Exclude<keyof T, keyof InteriorComponentBase | "type">;

export type LinkedInteriorComponent<
  T extends StandaloneInteriorComponent = StandaloneInteriorComponent,
> = T extends unknown
  ? Omit<T, InteriorConfigKeys<T> | "label" | "definitionId"> &
      Partial<Pick<T, InteriorConfigKeys<T>>> & {
        label?: string;
        /** Immutable AccessoryDefinition row id (identifies the exact version). */
        definitionId: string;
      }
  : never;

export type CabinetInteriorComponent =
  | StandaloneInteriorComponent
  | LinkedInteriorComponent;

// ─── Readiness codes ────────────────────────────────────────────────
//
// Phase 3 readiness is EXPOSED SEPARATELY from Phase 2 systemsReadiness
// in the effective-systems endpoint (interiorReadiness field). The
// InteriorComponentsSection renders its own summary — the Systems
// section is untouched.

export const INTERIOR_READINESS_CODES = [
  "INTERIOR_COMPONENT_TARGET_UNRESOLVED",
  "INTERIOR_COMPONENT_INCOMPATIBLE",
  "INTERIOR_COMPONENT_CAPABILITY_DEFERRED",
  "INTERIOR_COMPONENT_DUPLICATE_CONFLICT",
] as const;
export type InteriorReadinessCode = (typeof INTERIOR_READINESS_CODES)[number];

export interface InteriorReadinessIssue {
  code: InteriorReadinessCode;
  severity: "warning";
  detail: string;
  /** IDs of the components that produced this issue. Empty for the
   *  aggregate CAPABILITY_DEFERRED code that summarises all
   *  intentionally-unmodeled types on the cabinet. */
  componentIds: string[];
}

// ─── Cabinet-context shape needed by the compat / target engine ─────

export interface InteriorCabinetContext {
  cabinetType: CabinetType;
  doorCount: number;
  drawerCount: number;
  shelfCount: number;
}

// Re-exported here for module cohesion; the canonical enum lives in
// packages/shared/src/types/cabinet.ts.
import type { CabinetType } from "../../types/cabinet";
export type { CabinetType };
