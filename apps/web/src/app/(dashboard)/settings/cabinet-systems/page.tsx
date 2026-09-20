"use client";

import { useState } from "react";
import Link from "next/link";
import { FamilyRulesTab } from "@/components/settings/systems/FamilyRulesTab";
import { FrontSystemsTab } from "@/components/settings/systems/FrontSystemsTab";
import { DrawerSystemsTab } from "@/components/settings/systems/DrawerSystemsTab";
import { AssignmentsPanel } from "@/components/settings/systems/AssignmentsPanel";

type Tab = "family" | "front" | "drawer" | "defaults";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "family",   label: "Family Rules" },
  { id: "front",    label: "Front Systems" },
  { id: "drawer",   label: "Drawer Systems" },
  { id: "defaults", label: "Organization Defaults" },
];

export default function CabinetSystemsSettingsPage() {
  const [tab, setTab] = useState<Tab>("family");

  return (
    <div className="p-8 max-w-4xl">
      <div className="text-[11px] text-gray-500 mb-2">
        <Link href="/settings" className="hover:text-gray-300">Settings</Link>
        {" › "}
        <span className="text-gray-400">Cabinet Systems</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">Cabinet Systems</h1>
      <p className="text-gray-400 text-sm mb-6">
        Reusable family rules, front and drawer system libraries, and organization-wide defaults.
        Assignments cascade Organization → Project → Room → Cabinet.
      </p>

      <div className="border-b border-[#22262E] mb-5 flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              tab === t.id
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "family"   && <FamilyRulesTab />}
      {tab === "front"    && <FrontSystemsTab />}
      {tab === "drawer"   && <DrawerSystemsTab />}
      {tab === "defaults" && (
        <AssignmentsPanel
          scope="organization"
          title="Organization defaults"
          inheritLabel="Unassigned"
          helpText="These defaults apply to every project unless overridden at Project, Room, or Cabinet scope."
        />
      )}
    </div>
  );
}
