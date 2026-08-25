"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { useEditorStore } from "@/store/editor";
import { useMaterialsStore } from "@/store/materials";
import { useProject, useRoomCabinets } from "@/hooks/useProject";
import { useCabinets } from "@/hooks/useCabinets";
import { PropertiesPanel } from "./PropertiesPanel";
import { CabinetPreviewModal } from "./CabinetPreviewModal";
import { RoomSelector } from "./RoomSelector";
import { AddCabinetButton } from "./AddCabinetButton";
import { RoomShell } from "./RoomShell";
import { MaterialsPanel } from "./MaterialsPanel";
import AICopilotPanel, { type AICabinetSpec } from "./AICopilotPanel";
import { useCollab } from "@/hooks/useCollab";
import type { Cabinet, CabinetSpecInput, MaterialSlot } from "@woodcraft/shared";
import { compileUnit } from "@woodcraft/shared";
import { useSlotMaterial } from "@/lib/render/materials";

interface Props { projectId: string; }

// ─── Render-only detail constants (metres) ────────────────────────────────────
// All parametric geometry (toe-kick, countertop, doors, drawers, handle
// positions, panel dimensions) now comes from compileUnit(). These constants
// only control how the meshes look — thickness, inset, protrusion, bar cross-section.
const DOOR_T  = 0.019;  // 19 mm door / drawer-front slab thickness (visual)
const INSET   = 0.030;  // shaker border width around raised panel
const PNL_T   = 0.006;  // raised-panel protrusion above door face
const HDL_T   = 0.008;  // handle bar cross-section

// Selection highlight applied via emissive tint on top of the resolved
// material. Keeps the material cache warm across selection changes.
const SELECTION_EMISSIVE = "#c8852a";
const SELECTION_EMISSIVE_INTENSITY = 0.35;

// Legacy `finishStyle` → material-id seed. When a cabinet was created in
// the old PALETTES-based UI and the material selection is empty, this
// map provides a reasonable starting point per slot so the cabinet does
// not render as the platform default. Users can override via the
// MaterialsPanel UI.
type LegacyFinishSeed = Partial<Record<MaterialSlot, string>>;
const LEGACY_FINISH_SEEDS: Record<string, LegacyFinishSeed> = {
  light_oak:     { cabinetExterior: "wood-white-oak", door: "wood-white-oak", hardware: "metal-stainless" },
  natural_wood:  { cabinetExterior: "wood-walnut", door: "wood-walnut" },
  dark_walnut:   { cabinetExterior: "wood-dark-walnut", door: "wood-dark-walnut" },
  white_painted: { cabinetExterior: "painted-white", door: "painted-white" },
  modern_gloss:  { cabinetExterior: "painted-black", door: "laminate-gloss-black", hardware: "metal-stainless" },
  metal:         { cabinetExterior: "painted-black", door: "metal-matte-black", hardware: "metal-stainless" },
};

function legacyFinishSeed(finishStyle?: string): LegacyFinishSeed | undefined {
  return finishStyle ? LEGACY_FINISH_SEEDS[finishStyle] : undefined;
}

// Convert a DB Cabinet row into the CabinetSpecInput shape the compiler expects.
function cabinetToSpecInput(cabinet: Cabinet): CabinetSpecInput {
  return {
    name: cabinet.name,
    type: cabinet.type,
    width: Number(cabinet.width),
    height: Number(cabinet.height),
    depth: Number(cabinet.depth),
    posX: Number(cabinet.posX),
    posY: Number(cabinet.posY),
    posZ: Number(cabinet.posZ),
    parameters: (cabinet.parameters ?? {}) as CabinetSpecInput["parameters"],
  };
}

function CabinetMesh({ cabinet }: { cabinet: Cabinet }) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const isSelected    = useEditorStore((s) => s.selectedCabinetId) === cabinet.id;
  const selection     = useMaterialsStore((s) => s.selection);

  const prm         = (cabinet.parameters ?? {}) as Record<string, unknown>;
  const finishStyle = String(prm.finishStyle ?? "");

  // Compile this cabinet via the shared geometry compiler — same function
  // the DXF exporter and image-prompt builder use. All derived visuals
  // (drawer counts, door widths, handle positions, toe kick, countertop)
  // come from one canonical source.
  const unit = useMemo(
    () => compileUnit(cabinetToSpecInput(cabinet), finishStyle || "natural_wood"),
    [cabinet, finishStyle],
  );

  // Metres for Three.js
  const w  = Number(cabinet.width)  / 1000;
  const h  = Number(cabinet.height) / 1000;
  const d  = Number(cabinet.depth)  / 1000;
  const gx = Number(cabinet.posX)   / 1000;
  const gy = Number(cabinet.posY)   / 1000;
  const gz = Number(cabinet.posZ)   / 1000;

  const isGlass = finishStyle.includes("glass") ||
                  `${cabinet.name} ${String(prm.notes ?? "")}`.toLowerCase().includes("fish tank") ||
                  `${cabinet.name}`.toLowerCase().includes("aquarium");

  const features = unit.features;
  const toeH     = (features?.toeKickHeightMm ?? 0) / 1000;
  const carcassH = h - toeH;
  const carcassD = d - DOOR_T;

  const ct   = features?.countertop;
  const topH = ct ? ct.thicknessMm / 1000 : 0;
  const topOvS = ct ? ct.overhangSidesMm / 1000 : 0;
  const topOvF = ct ? ct.overhangFrontMm / 1000 : 0;
  const topW = w + 2 * topOvS;
  const topD = d + topOvF;
  const topZC = topD / 2;

  const isOpenShelf = unit.role === "open_shelf";

  // Build a selection object seeded with the legacy `finishStyle` when the
  // user has not yet chosen anything for this cabinet. This preserves the
  // visual identity of pre-materials cabinets on first load without
  // touching the DB.
  const effectiveSelection = useMemo(() => {
    const seed = legacyFinishSeed(finishStyle);
    if (!seed) return selection;
    const existing = selection.cabinets[cabinet.id];
    // Only apply the seed when no explicit selection exists at all.
    if (existing && Object.keys(existing).length > 0) return selection;
    return {
      ...selection,
      cabinets: {
        ...selection.cabinets,
        [cabinet.id]: seed,
      },
    };
  }, [selection, cabinet.id, finishStyle]);

  const emissiveArgs = isSelected
    ? { emissiveHex: SELECTION_EMISSIVE, emissiveIntensity: SELECTION_EMISSIVE_INTENSITY }
    : {};

  const carcassMat = useSlotMaterial(effectiveSelection, cabinet.id, "cabinetExterior", {
    face: { widthMm: Number(cabinet.width), heightMm: Number(cabinet.height) },
    ...emissiveArgs,
  });
  const shelfMat = useSlotMaterial(effectiveSelection, cabinet.id, isOpenShelf ? "cabinetInterior" : "shelf", {
    face: { widthMm: Number(cabinet.width), heightMm: Number(cabinet.depth) },
  });
  const toeKickMat = useSlotMaterial(effectiveSelection, cabinet.id, "toeKick", {
    face: { widthMm: Number(cabinet.width), heightMm: (features?.toeKickHeightMm ?? 100) },
    ...emissiveArgs,
  });
  const doorMat = useSlotMaterial(effectiveSelection, cabinet.id, "door", {
    face: { widthMm: Number(cabinet.width), heightMm: Number(cabinet.height) },
    opacityOverride: isGlass ? 0.28 : undefined,
    ...emissiveArgs,
  });
  const drawerFrontMat = useSlotMaterial(effectiveSelection, cabinet.id, "drawerFront", {
    face: { widthMm: Number(cabinet.width), heightMm: 200 },
    ...emissiveArgs,
  });
  const hardwareMat = useSlotMaterial(effectiveSelection, cabinet.id, "hardware", {
    face: { widthMm: 100, heightMm: 20 },
  });
  const countertopMat = useSlotMaterial(effectiveSelection, cabinet.id, "countertop", {
    face: { widthMm: Number(cabinet.width) + (ct?.overhangSidesMm ?? 0) * 2, heightMm: Number(cabinet.depth) + (ct?.overhangFrontMm ?? 0) },
  });

  return (
    <group
      position={[gx, gy, gz]}
      onClick={(e) => { e.stopPropagation(); selectCabinet(cabinet.id); }}
    >
      {/* Solid carcass — skip for open shelves (they render as an open frame
          via the compiled shelves list below). */}
      {!isOpenShelf && (
        <mesh position={[w / 2, toeH + carcassH / 2, carcassD / 2]} castShadow receiveShadow material={carcassMat}>
          <boxGeometry args={[w, carcassH, carcassD]} />
        </mesh>
      )}

      {/* Compiled shelf/frame panels — outer frame + back + horizontal shelves + vertical dividers. */}
      {(features?.shelves ?? []).map((s) => {
        const sw = s.widthMm  / 1000;
        const sh = s.heightMm / 1000;
        const sd = s.depthMm  / 1000;
        return (
          <mesh
            key={s.id}
            position={[
              s.x / 1000 + sw / 2,
              s.y / 1000 + sh / 2,
              s.z / 1000 + sd / 2,
            ]}
            castShadow
            receiveShadow
            material={shelfMat}
          >
            <boxGeometry args={[sw, sh, sd]} />
          </mesh>
        );
      })}

      {/* Toe-kick board — bottom-front strip */}
      {toeH > 0 && (
        <mesh position={[w / 2, toeH / 2, d - DOOR_T / 2]} material={toeKickMat}>
          <boxGeometry args={[w, toeH, DOOR_T]} />
        </mesh>
      )}

      {/* Door and drawer front panels — compiled features */}
      {(features?.fronts ?? []).map((f, i) => {
        const pw = f.widthMm     / 1000;
        const ph = f.heightMm    / 1000;
        const pt = f.thicknessMm / 1000;
        const px = (f.x + f.widthMm  / 2) / 1000;
        const py = (f.y + f.heightMm / 2) / 1000;
        const pzC = d - pt / 2;

        const iw = pw - 2 * INSET;
        const ih = ph - 2 * INSET;
        const showShaker = f.hasShakerInset && iw > 0.04 && ih > 0.04;
        const frontMat = f.kind === "drawer" ? drawerFrontMat : doorMat;

        return (
          <group key={i}>
            {/* Front slab — reuses the resolved door/drawer material */}
            <mesh position={[px, py, pzC]} castShadow receiveShadow material={frontMat}>
              <boxGeometry args={[pw, ph, pt]} />
            </mesh>

            {/* Aquarium water volume — only for glass units */}
            {isGlass && (
              <mesh position={[px, py, carcassD / 2]}>
                <boxGeometry args={[pw - 0.04, ph - 0.04, carcassD - 0.04]} />
                <meshStandardMaterial color="#083858" transparent opacity={0.55} roughness={0.1} />
              </mesh>
            )}

            {/* Shaker raised centre panel — skip for glass */}
            {showShaker && !isGlass && (
              <mesh position={[px, py, d + PNL_T / 2]} material={frontMat}>
                <boxGeometry args={[iw, ih, PNL_T]} />
              </mesh>
            )}

            {/* Handle bar — skip for glass/aquarium */}
            {!isGlass && f.handle && (
              <mesh position={[f.handle.x / 1000, f.handle.y / 1000, d + HDL_T / 2]} material={hardwareMat}>
                <boxGeometry args={f.handle.orientation === "horizontal"
                  ? [f.handle.lengthMm / 1000, HDL_T, HDL_T]
                  : [HDL_T, f.handle.lengthMm / 1000, HDL_T]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Countertop slab — only when the compiler says so */}
      {ct && (
        <mesh position={[w / 2, h + topH / 2, topZC]} castShadow receiveShadow material={countertopMat}>
          <boxGeometry args={[topW, topH, topD]} />
        </mesh>
      )}
    </group>
  );
}

// ── Opening mesh — a labeled empty recess (e.g. TV mount zone) ────────────────
// Renders as a thin dark recessed back panel + a subtle outlined frame. No doors,
// no shelves. Skipped by the DXF exporter.
function OpeningMesh({ cabinet }: { cabinet: Cabinet }) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const isSelected    = useEditorStore((s) => s.selectedCabinetId) === cabinet.id;

  const w  = Number(cabinet.width)  / 1000;
  const h  = Number(cabinet.height) / 1000;
  const d  = Math.max(0.005, Number(cabinet.depth) / 1000);
  const gx = Number(cabinet.posX)   / 1000;
  const gy = Number(cabinet.posY)   / 1000;
  const gz = Number(cabinet.posZ)   / 1000;

  const frame = isSelected ? "#c8852a" : "#3a3a3e";

  return (
    <group
      position={[gx, gy, gz]}
      onClick={(e) => { e.stopPropagation(); selectCabinet(cabinet.id); }}
    >
      {/* Recessed dark back panel — represents the drywall behind the TV */}
      <mesh position={[w / 2, h / 2, d]}>
        <boxGeometry args={[w, h, 0.005]} />
        <meshStandardMaterial color="#111114" roughness={0.9} metalness={0} />
      </mesh>
      {/* Slim frame around the opening */}
      <lineSegments position={[w / 2, h / 2, d + 0.003]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, 0.001)]} />
        <lineBasicMaterial color={frame} />
      </lineSegments>
    </group>
  );
}

// ── LED strip mesh — a thin warm-glow bar with no shadow casting ──────────────
// Skipped by the DXF exporter.
function LedStripMesh({ cabinet }: { cabinet: Cabinet }) {
  const selectCabinet = useEditorStore((s) => s.selectCabinet);
  const w  = Math.max(0.02, Number(cabinet.width)  / 1000);
  const h  = Math.max(0.005, Number(cabinet.height) / 1000);
  const d  = Math.max(0.005, Number(cabinet.depth) / 1000);
  const gx = Number(cabinet.posX) / 1000;
  const gy = Number(cabinet.posY) / 1000;
  const gz = Number(cabinet.posZ) / 1000;

  return (
    <group
      position={[gx, gy, gz]}
      onClick={(e) => { e.stopPropagation(); selectCabinet(cabinet.id); }}
    >
      <mesh position={[w / 2, h / 2, d / 2]}>
        <boxGeometry args={[w, h, d]} />
        {/* Unlit, glowing material — toneMapped false so it stays bright */}
        <meshBasicMaterial color="#ffcc88" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Render dispatch — pick the right mesh based on parameters.role ────────────
function CabinetSceneItem({ cabinet }: { cabinet: Cabinet }) {
  const params = (cabinet.parameters ?? {}) as { role?: string };
  if (params.role === "opening")   return <OpeningMesh   cabinet={cabinet} />;
  if (params.role === "led_strip") return <LedStripMesh  cabinet={cabinet} />;
  return <CabinetMesh cabinet={cabinet} />;
}

// ── NavigationHint — floating hint showing how to rotate the 3D view ─────────
// Distinguishes mobile vs desktop by VIEWPORT WIDTH (not by touch capability —
// many Windows laptops support touch but the user is on a desktop-sized view).
// Appears once per page load, auto-dismisses after 8 s or on close-button click.
function NavigationHint() {
  const [visible, setVisible]  = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [fadingOut, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // "Mobile view" = viewport narrower than Tailwind's md breakpoint (768 px).
    // Reactive: updates if the user resizes / rotates their device.
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const dismiss = useCallback(() => {
    setFading(true);
    window.setTimeout(() => setVisible(false), 350);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(t);
  }, [visible, dismiss]);

  if (!visible) return null;

  const icon = isMobile ? "✌️" : "🖱️";
  const gesture = isMobile
    ? "Use two fingers to rotate the view"
    : "Right-click + drag to rotate the view";
  const secondary = isMobile
    ? "Pinch to zoom · One finger to pan"
    : "Scroll to zoom · Left-click to select a cabinet";

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30"
      style={{
        bottom: 96, // sits well above the bottom edge, clear of any floating buttons
        opacity: fadingOut ? 0 : 1,
        transform: `translateX(-50%) translateY(${fadingOut ? "8px" : "0"})`,
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div
        className="flex items-center gap-3 rounded-full"
        style={{
          background: "rgba(14, 17, 20, 0.94)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(232, 197, 71, 0.32)",
          padding: "10px 12px 10px 18px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          minWidth: 300,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <div className="flex flex-col flex-1 min-w-0">
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#E8C547",
              letterSpacing: "0.3px",
              lineHeight: 1.4,
            }}
          >
            {gesture}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#9CA3AF",
              letterSpacing: "0.2px",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {secondary}
          </span>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 rounded-full transition-colors"
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#6A7280",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#E8C547")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#6A7280")}
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function CabinetEditor({ projectId }: Props) {
  const { project, loading: projectLoading } = useProject(projectId);
  const { selectedRoomId, cabinets, selectedCabinetId, selectCabinet } = useEditorStore();
  const { loading: roomLoading }                                        = useRoomCabinets(projectId, selectedRoomId);
  const { create, save, remove, validate, saving, validating, validationReports } = useCabinets(projectId);
  const { broadcast: _broadcast }                                       = useCollab(projectId);

  const [leftOpen,     setLeftOpen]     = useState(false);
  const [rightOpen,    setRightOpen]    = useState(false);
  const [copilotOpen,  setCopilotOpen]  = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [previewId,    setPreviewId]    = useState<string | null>(null);

  // Bootstrap the per-project material selection from localStorage on
  // project change. The store falls back to an empty selection when no
  // saved state exists — resolver defaults handle first-time rendering.
  const loadMaterialsForProject = useMaterialsStore((s) => s.loadForProject);
  useEffect(() => {
    if (projectId) loadMaterialsForProject(projectId);
  }, [projectId, loadMaterialsForProject]);

  const selectedRoom = useMemo(
    () => project?.rooms?.find((r) => r.id === selectedRoomId),
    [project?.rooms, selectedRoomId],
  );

  async function handleAddCabinets(specs: AICabinetSpec[]) {
    // When the AI returns floor-plan positions (sketch-to-CAD path), use them directly.
    // For left/right wall cabinets, swap width ↔ depth so the box renders in the
    // correct orientation (width runs along the wall, depth goes into the room).
    // When positions are absent (co-pilot chat path), fall back to auto-layout.
    const hasPositions = specs.some(
      (s) => s.posX !== undefined && s.posZ !== undefined
    );

    let perimeterX = 0;
    let islandX    = 0;

    for (const spec of specs) {
      let posX: number, posY: number, posZ: number;
      let createWidth = spec.width;
      let createDepth = spec.depth;

      if (hasPositions && spec.posX !== undefined && spec.posZ !== undefined) {
        // ── Sketch path: AI-supplied floor-plan coordinates ──────────────
        posX = spec.posX;
        posZ = spec.posZ;
        // Use AI-provided posY when available; fall back to 1371 only for kitchen wall cabs
        posY = spec.posY ?? (spec.type === "wall" ? 1371 : 0);

        // Left/right wall cabinets need width ↔ depth swap so the box
        // renders with its length running along the wall (Z axis) and its
        // depth going into the room (X axis).
        if (spec.wallSide === "left" || spec.wallSide === "right") {
          createWidth = spec.depth;  // X extent = cabinet depth (into room)
          createDepth = spec.width;  // Z extent = cabinet length (along wall)
        }
      } else {
        // ── Auto-layout fallback (co-pilot chat, no positions) ────────────
        if (spec.type === "island") {
          posX = islandX;
          posY = 0;
          posZ = 1219; // 48" out from the back wall
          islandX += spec.width;
        } else if (spec.type === "wall") {
          posX = perimeterX;
          posY = 1371;
          posZ = 152;
          perimeterX += spec.width;
        } else {
          posX = perimeterX;
          posY = 0;
          posZ = 0;
          perimeterX += spec.width;
        }
      }

      await create({
        type:       spec.type,
        name:       spec.name,
        width:      createWidth,
        height:     spec.height,
        depth:      createDepth,
        posX,
        posY,
        posZ,
        parameters: spec.parameters,
      });
    }
  }

  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId);
  const isLoading       = projectLoading || roomLoading;

  // Auto-open properties sheet when a cabinet is selected
  useEffect(() => {
    if (selectedCabinetId) setRightOpen(true);
  }, [selectedCabinetId]);

  // Close right sheet when selection is cleared
  useEffect(() => {
    if (!selectedCabinetId) setRightOpen(false);
  }, [selectedCabinetId]);

  // Set the AI Co-pilot's initial state on room entry:
  //   · Empty room  → open (help the user get started)
  //   · Populated room → closed (give the 3D scene the full view)
  //
  // Timing subtlety: when selectedRoomId changes, `cabinets` in the store still
  // holds the PREVIOUS room's data until useRoomCabinets finishes fetching. So
  // we can't just react to selectedRoomId — we'd read stale cabinet counts.
  //
  // Instead: watch `roomLoading` and only act on the true→false transition,
  // which happens right after setCabinets() so `cabinets` is guaranteed fresh.
  // Once per room via `lastAppliedRoomRef` — the user can toggle manually
  // without the effect fighting them.
  const prevRoomLoadingRef  = useRef(false);
  const lastAppliedRoomRef  = useRef<string | null>(null);
  useEffect(() => {
    const wasLoading = prevRoomLoadingRef.current;
    prevRoomLoadingRef.current = roomLoading;

    // Only fire when a load cycle just completed for the current room.
    if (!(wasLoading && !roomLoading)) return;
    if (!selectedRoomId) return;
    if (lastAppliedRoomRef.current === selectedRoomId) return;

    lastAppliedRoomRef.current = selectedRoomId;
    setCopilotOpen(cabinets.length === 0);
  }, [selectedRoomId, roomLoading, cabinets.length]);

  if (projectLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-gray-500 text-sm">
        Loading project…
      </div>
    );
  }

  const anyPanelOpen = leftOpen || rightOpen;

  return (
    <div className="flex h-full overflow-hidden relative">

      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      {anyPanelOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />
      )}

      {/* ── Left panel: Rooms + Cabinet list ─────────────────────────────
           Mobile  → fixed left drawer, slides in/out
           Desktop → static flex column                                   */}
      <aside
        className={[
          "flex flex-col flex-shrink-0",
          "fixed inset-y-0 left-0 z-20 w-72",
          "transition-transform duration-300 ease-in-out",
          leftOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:w-52 md:translate-x-0 md:z-auto md:transition-none",
        ].join(" ")}
        style={{ background: "#111214", borderRight: "1px solid #1E2226" }}
      >
        {/* Panel header */}
        <div
          className="px-3 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid #1E2226" }}
        >
          <p className="text-xs text-gray-400 uppercase tracking-widest">Rooms</p>
          {/* Close button — mobile only */}
          <button
            className="md:hidden text-gray-500 hover:text-white transition-colors p-1"
            onClick={() => setLeftOpen(false)}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="p-3" style={{ borderBottom: "1px solid #1E2226" }}>
          <RoomSelector rooms={project?.rooms ?? []} projectId={projectId} />
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Cabinets</p>
            <AddCabinetButton projectId={projectId} />
          </div>

          {cabinets.length === 0 ? (
            <p className="text-xs text-gray-600 px-1 mt-3">No cabinets yet.</p>
          ) : (
            <div className="space-y-0.5">
              {cabinets.map((cab) => (
                <button
                  key={cab.id}
                  onClick={() => {
                    selectCabinet(cab.id);
                    setLeftOpen(false); // close drawer after picking on mobile
                  }}
                  className={[
                    "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors",
                    selectedCabinetId === cab.id
                      ? "bg-brand-500/20 text-brand-400"
                      : "text-gray-400 hover:bg-surface-200 hover:text-white",
                  ].join(" ")}
                >
                  <span className="block truncate font-medium">{cab.name}</span>
                  <span className="block text-xs text-gray-600 capitalize mt-0.5">{cab.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── 3D Viewport ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0">
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-surface-100 border border-surface-300 rounded-full px-3 py-1 text-xs text-gray-400">
            Updating…
          </div>
        )}

        {/* ── Mobile floating controls ─────────────────────────────────── */}

        {/* Cabinets toggle — top-left */}
        <button
          className="absolute top-3 left-3 z-10 md:hidden flex items-center gap-1.5 text-xs text-white font-medium rounded-lg px-3 py-2 transition-colors"
          style={{ background: "#1A1E26", border: "1px solid #2E3240" }}
          onClick={() => { setLeftOpen(true); setRightOpen(false); }}
        >
          <span style={{ fontSize: 13 }}>☰</span>
          <span>Cabinets{cabinets.length > 0 ? ` (${cabinets.length})` : ""}</span>
        </button>

        {/* AI Co-pilot toggle — top-right */}
        <button
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-all"
          style={{
            background: copilotOpen ? "#c8852a" : "#1A1E26",
            border: copilotOpen ? "1px solid #c8852a" : "1px solid #2E3240",
            color: copilotOpen ? "#fff" : "#c8852a",
          }}
          onClick={() => setCopilotOpen((v) => !v)}
        >
          <span>✦</span>
          <span>AI Co-pilot</span>
        </button>

        {/* Materials toggle — sits just below the AI Co-pilot button */}
        <button
          className="absolute top-14 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-all"
          style={{
            background: materialsOpen ? "#3d7fff" : "#1A1E26",
            border: materialsOpen ? "1px solid #3d7fff" : "1px solid #2E3240",
            color: materialsOpen ? "#fff" : "#8ab4ff",
          }}
          onClick={() => setMaterialsOpen((v) => !v)}
          aria-label="Toggle materials panel"
        >
          <span>◐</span>
          <span>Materials</span>
        </button>

        {/* Properties toggle — bottom-centre, only when cabinet is selected */}
        {selectedCabinet && (
          <button
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 md:hidden flex items-center gap-2 text-xs font-bold rounded-full px-5 py-2.5 transition-colors"
            style={{
              background: rightOpen ? "#2E2E2E" : "#c8852a",
              color: rightOpen ? "#9A9090" : "#fff",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
            onClick={() => setRightOpen((v) => !v)}
          >
            {rightOpen ? "✕  Close" : `⚙  ${selectedCabinet.name}`}
          </button>
        )}

        <Canvas
          shadows
          camera={{ position: [3, 2.5, 4], fov: 50 }}
          onPointerMissed={() => selectCabinet(null)}
        >
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <Grid
            args={[20, 20]}
            cellSize={0.6} cellThickness={0.5} cellColor="#2e2e2e"
            sectionSize={1.2} sectionThickness={1} sectionColor="#3a3a3a"
            fadeDistance={30} fadeStrength={1} followCamera={false} infiniteGrid
          />
          {selectedRoom && (
            <RoomShell room={selectedRoom} cabinets={cabinets} />
          )}
          {cabinets.map((cab) => (
            <CabinetSceneItem key={cab.id} cabinet={cab} />
          ))}
          <OrbitControls makeDefault />
          <Environment preset="warehouse" background={false} />
        </Canvas>

        {cabinets.length === 0 && !isLoading && !copilotOpen && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-500 text-sm">Add a cabinet to get started.</p>
          </div>
        )}

        {/* 3D navigation hint — shows how to rotate the view */}
        {cabinets.length > 0 && <NavigationHint />}

        {/* AI Co-pilot panel */}
        <AICopilotPanel
          projectId={projectId}
          roomId={selectedRoomId}
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          onAddCabinets={handleAddCabinets}
        />

        {/* Materials panel — room + selected cabinet material pickers */}
        <MaterialsPanel
          isOpen={materialsOpen}
          onClose={() => setMaterialsOpen(false)}
          selectedCabinet={selectedCabinet}
        />
      </div>

      {/* ── Properties panel ─────────────────────────────────────────────
           Mobile  → fixed bottom sheet, slides up/down
           Desktop → static right column
           Hidden entirely when the room has 0 cabinets — nothing to edit,
           so the space belongs to the 3D scene / AI Co-pilot instead.       */}
      {cabinets.length > 0 && (
        <PropertiesPanel
          cabinet={selectedCabinet}
          saving={saving}
          validating={validating}
          validationReport={selectedCabinetId ? validationReports[selectedCabinetId] : undefined}
          onSave={save}
          onDelete={remove}
          onValidate={validate}
          onPreview={setPreviewId}
          mobileOpen={rightOpen}
          onMobileClose={() => setRightOpen(false)}
        />
      )}

      {previewId && (() => {
        const cab = cabinets.find((c) => c.id === previewId);
        return cab ? (
          <CabinetPreviewModal
            cabinet={cab}
            projectId={projectId}
            onClose={() => setPreviewId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
