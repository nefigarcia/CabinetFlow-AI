// Shared human labels for interior-component types + target kinds.
// Kept in a tiny module so both the section card list and the add/edit
// modal use the exact same strings — a rename anywhere shows up
// everywhere.

import type {
  InteriorComponentType,
  InteriorTargetKind,
} from "@woodcraft/shared";

export const INTERIOR_TYPE_LABELS: Record<InteriorComponentType, string> = {
  rollout: "Rollout",
  trash_pullout: "Trash Pullout",
  tray_divider: "Tray Divider",
  spice_rack: "Spice Rack",
  knife_organizer: "Knife Organizer",
  utensil_divider: "Utensil Divider",
  drawer_divider: "Drawer Divider",
  hidden_drawer: "Hidden Drawer",
  sink_pullout: "Sink Pullout",
  sponge_tilt_out: "Sponge Tilt-Out",
  custom: "Custom",
};

export interface InteriorTypeCategory {
  id: "storage" | "drawer_org" | "waste_sink" | "special";
  label: string;
  types: InteriorComponentType[];
}

export const INTERIOR_TYPE_CATEGORIES: InteriorTypeCategory[] = [
  {
    id: "storage",
    label: "Storage",
    types: ["rollout", "tray_divider"],
  },
  {
    id: "drawer_org",
    label: "Drawer Organization",
    types: ["utensil_divider", "knife_organizer", "drawer_divider", "hidden_drawer"],
  },
  {
    id: "waste_sink",
    label: "Waste / Sink",
    types: ["trash_pullout", "sink_pullout", "sponge_tilt_out"],
  },
  {
    id: "special",
    label: "Special",
    types: ["spice_rack", "custom"],
  },
];

export const INTERIOR_TARGET_KIND_LABELS: Record<InteriorTargetKind, string> = {
  cabinet: "Cabinet",
  drawer: "Drawer",
  door: "Door",
  shelf: "Shelf",
};

/** UI convention: humans see 1-based indices ("Drawer 1"), storage
 *  uses 0-based internally. */
export function humanTargetLabel(
  kind: InteriorTargetKind,
  index?: number,
): string {
  if (kind === "cabinet") return "Cabinet";
  if (index === undefined) return INTERIOR_TARGET_KIND_LABELS[kind];
  return `${INTERIOR_TARGET_KIND_LABELS[kind]} ${index + 1}`;
}
