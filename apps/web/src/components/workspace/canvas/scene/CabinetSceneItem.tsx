"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useEditorStore } from "@/store/editor";
import { useMaterialsStore } from "@/store/materials";
import { useSlotMaterial } from "@/lib/render/materials";
import type { Cabinet, CabinetSpecInput, MaterialSlot } from "@woodcraft/shared";
import { compileUnit } from "@woodcraft/shared";

// Cabinet scene items — CabinetMesh, OpeningMesh, LedStripMesh, and the
// dispatch CabinetSceneItem — extracted verbatim from the legacy
// CabinetEditor.tsx during STEP 2 of the premium workspace epic.
// Behavior unchanged: same materials, same handles, same glass path.

// ─── Render-only detail constants (metres) ───────────────────────────────────
// All parametric geometry (toe-kick, countertop, doors, drawers, handle
// positions, panel dimensions) comes from compileUnit(). These constants
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
// not render as the platform default.
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

  const unit = useMemo(
    () => compileUnit(cabinetToSpecInput(cabinet), finishStyle || "natural_wood"),
    [cabinet, finishStyle],
  );

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

  const effectiveSelection = useMemo(() => {
    const seed = legacyFinishSeed(finishStyle);
    if (!seed) return selection;
    const existing = selection.cabinets[cabinet.id];
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
      {!isOpenShelf && (
        <mesh position={[w / 2, toeH + carcassH / 2, carcassD / 2]} castShadow receiveShadow material={carcassMat}>
          <boxGeometry args={[w, carcassH, carcassD]} />
        </mesh>
      )}

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

      {toeH > 0 && (
        <mesh position={[w / 2, toeH / 2, d - DOOR_T / 2]} material={toeKickMat}>
          <boxGeometry args={[w, toeH, DOOR_T]} />
        </mesh>
      )}

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
            <mesh position={[px, py, pzC]} castShadow receiveShadow material={frontMat}>
              <boxGeometry args={[pw, ph, pt]} />
            </mesh>

            {isGlass && (
              <mesh position={[px, py, carcassD / 2]}>
                <boxGeometry args={[pw - 0.04, ph - 0.04, carcassD - 0.04]} />
                <meshStandardMaterial color="#083858" transparent opacity={0.55} roughness={0.1} />
              </mesh>
            )}

            {showShaker && !isGlass && (
              <mesh position={[px, py, d + PNL_T / 2]} material={frontMat}>
                <boxGeometry args={[iw, ih, PNL_T]} />
              </mesh>
            )}

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

      {ct && (
        <mesh position={[w / 2, h + topH / 2, topZC]} castShadow receiveShadow material={countertopMat}>
          <boxGeometry args={[topW, topH, topD]} />
        </mesh>
      )}
    </group>
  );
}

// ── Opening mesh — a labeled empty recess (e.g. TV mount zone) ────────────────
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
      <mesh position={[w / 2, h / 2, d]}>
        <boxGeometry args={[w, h, 0.005]} />
        <meshStandardMaterial color="#111114" roughness={0.9} metalness={0} />
      </mesh>
      <lineSegments position={[w / 2, h / 2, d + 0.003]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, 0.001)]} />
        <lineBasicMaterial color={frame} />
      </lineSegments>
    </group>
  );
}

// ── LED strip mesh — a thin warm-glow bar with no shadow casting ──────────────
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
        <meshBasicMaterial color="#ffcc88" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Render dispatch — pick the right mesh based on parameters.role ────────────
export function CabinetSceneItem({ cabinet }: { cabinet: Cabinet }) {
  const params = (cabinet.parameters ?? {}) as { role?: string };
  if (params.role === "opening")   return <OpeningMesh   cabinet={cabinet} />;
  if (params.role === "led_strip") return <LedStripMesh  cabinet={cabinet} />;
  return <CabinetMesh cabinet={cabinet} />;
}
