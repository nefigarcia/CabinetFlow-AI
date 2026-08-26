"use client";

import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { useEditorStore } from "@/store/editor";
import type { ValidationReport } from "@/hooks/useCabinets";
import type { Cabinet } from "@woodcraft/shared";

// The Cabinet inspector wraps the existing PropertiesPanel — same data
// flow, same optimistic updates, same debounced constraint propagation.
// The premium workspace shell owns positioning; PropertiesPanel keeps
// providing dimensions / parameters / parts / validation content.

interface Props {
  cabinet: Cabinet | undefined;
  saving: boolean;
  validating: boolean;
  validationReport?: ValidationReport;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onValidate: (id: string) => Promise<void>;
  onPreview: (id: string) => void;
}

export function CabinetInspector({
  cabinet,
  saving,
  validating,
  validationReport,
  onSave,
  onDelete,
  onValidate,
  onPreview,
}: Props) {
  // PropertiesPanel already ships with its own `<aside>` chrome. Rather
  // than duplicate the entire (~660 line) form logic in a new component,
  // we render it here inside the Inspector's tab area. Its outer style
  // matches the panel width the Inspector expects.
  return (
    <div className="h-full flex flex-col">
      <PropertiesPanel
        cabinet={cabinet}
        saving={saving}
        validating={validating}
        validationReport={validationReport}
        onSave={onSave}
        onDelete={onDelete}
        onValidate={onValidate}
        onPreview={onPreview}
      />
    </div>
  );
}

/** Empty-state helper used when nothing is selected. */
export function CabinetInspectorEmpty() {
  const cabinetCount = useEditorStore((s) => s.cabinets.length);
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-gray-600 text-xs text-center">
        {cabinetCount === 0
          ? "Add a cabinet to get started."
          : "Select a cabinet in the 3D view to edit its properties."}
      </p>
    </div>
  );
}
