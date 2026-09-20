// Shared types + helpers for the Cabinet Systems settings surfaces.
// Match the server row shapes returned by /api/systems/*.

export const CABINET_TYPES = [
  "base",
  "wall",
  "tall",
  "corner",
  "drawer_base",
  "sink_base",
  "island",
] as const;
export type CabinetType = (typeof CABINET_TYPES)[number];

export const CABINET_TYPE_LABELS: Record<CabinetType, string> = {
  base: "Base",
  wall: "Wall",
  tall: "Tall",
  corner: "Corner",
  drawer_base: "Drawer Base",
  sink_base: "Sink Base",
  island: "Island",
};

export const FRONT_KINDS = [
  "hinged_single",
  "hinged_double",
  "bifold",
  "pocket",
  "open",
  "fixed_panel",
] as const;

export const FRONT_ROLES = ["cabinet_front", "appliance_panel"] as const;

export const DRAWER_JOINERIES = [
  "dovetail",
  "dowel",
  "confirmat",
  "rabbet_dado",
  "butt_screw",
] as const;

export const FIXED_SHELF_POLICIES = ["none", "structural", "optional"] as const;
export const CORNER_VARIANTS = ["blind_left", "blind_right", "l_corner"] as const;

export interface FamilyRule {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  cabinetType: CabinetType;
  hasToeKick: boolean | null;
  hasBack: boolean | null;
  hasNailer: boolean | null;
  fixedShelfPolicy: string | null;
  cornerVariant: string | null;
  toeHeightMm: number | null;
  toeRecessMm: number | null;
  topRevealMm: number | null;
  bottomRevealMm: number | null;
  topScribeMm: number | null;
  bottomScribeMm: number | null;
  verificationStatus: string;
  sourceRef: string | null;
  updatedAt: string;
}

export interface FrontSystem {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  kind: string;
  role: string;
  glassFlag: boolean;
  verificationStatus: string;
  sourceRef: string | null;
  updatedAt: string;
}

export interface DrawerSystem {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  kind: "traditional" | "proprietary";
  boxSideThicknessMm: number | null;
  boxBottomThicknessMm: number | null;
  boxBackThicknessMm: number | null;
  boxSubFrontThicknessMm: number | null;
  boxJoinery: string | null;
  proprietaryFamily: string | null;
  verificationStatus: string;
  sourceRef: string | null;
  updatedAt: string;
}

export interface OrgAssignments {
  familyRuleIdsByCabinetType?: Partial<Record<CabinetType, string>>;
  preferredFrontSystemId?: string;
  preferredDrawerSystemId?: string;
}

export function cabinetTypeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  return (CABINET_TYPE_LABELS as Record<string, string>)[t] ?? t;
}

export function humanKind(k: string): string {
  return k.replace(/_/g, " ");
}

export function mmDisplay(mm: number | null | undefined): string {
  if (mm === null || mm === undefined) return "—";
  const inch = (mm / 25.4);
  return `${mm} mm  ·  ${inch.toFixed(3)}″`;
}
