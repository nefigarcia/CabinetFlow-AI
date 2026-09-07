"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SCENE_ASSET_CATEGORIES,
  SCENE_ASSET_CATEGORY_LABELS,
  type SceneAssetCategory,
  type SceneAssetDefinitionCreateInput,
  type SceneAssetDefinitionScope,
} from "@woodcraft/shared";
import { createSceneAssetDefinitionMultipart } from "@/hooks/useSceneAssetDefinitions";
import { probeGlbDimensionsMm } from "@/lib/scene/probeGlbDimensions";
import { useAuthStore } from "@/store/auth";

// Add Asset modal — the primary product entry point for the DB-backed
// Asset Library.
//
// Client-side validation is a courtesy: the SERVER re-runs the same
// checks (extension, size, GLB magic header, canonical key composition,
// duplicate slug, provenance required for GLBs) via the shared upload
// service. This modal fails fast on obvious mistakes without letting
// them into the request.

const MAX_MODEL_BYTES = 50 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddAssetModal({ onClose, onCreated }: Props) {
  // Client-side admin flag drives ONLY whether the Availability picker
  // is visible. Server-side `isPlatformAdmin(ctx)` gates the actual
  // SYSTEM write on the POST — a forged `isPlatformAdmin: true` in
  // localStorage cannot escalate privileges.
  const isPlatformAdmin = useAuthStore(
    (s) => s.user?.isPlatformAdmin === true,
  );
  const [scope, setScope] = useState<SceneAssetDefinitionScope>(
    isPlatformAdmin ? "system" : "org",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SceneAssetCategory>("furniture");
  const [widthMm, setWidthMm] = useState(600);
  const [heightMm, setHeightMm] = useState(720);
  const [depthMm, setDepthMm] = useState(560);
  const [placementFloor, setPlacementFloor] = useState(true);
  const [placementWall, setPlacementWall] = useState(false);
  const [placementCeiling, setPlacementCeiling] = useState(false);
  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const [clearanceFront, setClearanceFront] = useState(0);
  const [manufacturer, setManufacturer] = useState("");
  const [sku, setSku] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [license, setLicense] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Client-side GLB header check on file pick — fast fail before upload.
  const [modelError, setModelError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeNote, setProbeNote] = useState<string | null>(null);

  const handleModelPick = async (f: File | null) => {
    setModelError(null);
    setProbeNote(null);
    if (!f) {
      setModelFile(null);
      return;
    }
    if (!/\.(glb|gltf)$/i.test(f.name)) {
      setModelError("Model must be a .glb or .gltf file.");
      return;
    }
    if (f.size === 0) {
      setModelError("Model file is empty.");
      return;
    }
    if (f.size > MAX_MODEL_BYTES) {
      setModelError(`Model exceeds ${MAX_MODEL_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    if (f.name.toLowerCase().endsWith(".glb")) {
      // Read the first 4 bytes to confirm the glTF magic header.
      const buf = await f.slice(0, 4).arrayBuffer();
      const magic = new TextDecoder().decode(new Uint8Array(buf));
      if (magic !== "glTF") {
        setModelError('File does not begin with the "glTF" magic header. Not a valid GLB.');
        return;
      }
    }
    setModelFile(f);

    // Probe the GLB's actual bounding box so dimensions reflect the
    // model instead of a stale 600×720×560 default. Failures are
    // non-fatal — user can still adjust the fields manually.
    setProbing(true);
    try {
      const probed = await probeGlbDimensionsMm(f);
      if (probed) {
        setWidthMm(probed.widthMm);
        setHeightMm(probed.heightMm);
        setDepthMm(probed.depthMm);
        setProbeNote(
          `Dimensions auto-detected from GLB bounding box (${probed.widthMm} × ${probed.heightMm} × ${probed.depthMm} mm). Adjust if the model was authored with padding.`,
        );
      } else {
        setProbeNote(
          "Couldn't auto-detect dimensions from the model. Please enter them manually.",
        );
      }
    } catch {
      setProbeNote(
        "Couldn't auto-detect dimensions from the model. Please enter them manually.",
      );
    } finally {
      setProbing(false);
    }
  };

  const handleThumbnailPick = (f: File | null) => {
    setThumbnailError(null);
    if (!f) {
      setThumbnailFile(null);
      return;
    }
    if (!/\.(webp|png|jpe?g)$/i.test(f.name)) {
      setThumbnailError("Thumbnail must be .webp, .png, or .jpg.");
      return;
    }
    if (f.size === 0) {
      setThumbnailError("Thumbnail file is empty.");
      return;
    }
    if (f.size > MAX_THUMBNAIL_BYTES) {
      setThumbnailError(`Thumbnail exceeds ${MAX_THUMBNAIL_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setThumbnailFile(f);
  };

  // Human-readable list of missing required fields — surfaced next to
  // the disabled Upload button so the user isn't left guessing.
  const missing = useMemo(() => {
    const out: string[] = [];
    if (!modelFile) out.push("3D model (GLB)");
    if (name.trim().length === 0) out.push("Name");
    if (widthMm <= 0 || heightMm <= 0 || depthMm <= 0) out.push("Positive dimensions");
    if (license.trim().length === 0) out.push("License");
    if (sourceName.trim().length === 0) out.push("Source name");
    return out;
  }, [name, widthMm, heightMm, depthMm, modelFile, license, sourceName]);

  const isValid = missing.length === 0 && !modelError && !thumbnailError;

  const handleSubmit = async () => {
    if (!isValid || !modelFile || submitting) return;
    setSubmitting(true);
    setError(null);
    setWarnings([]);
    const metadata: SceneAssetDefinitionCreateInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      dimensionsMm: { widthMm, heightMm, depthMm },
      placement: {
        floorMounted: placementFloor || undefined,
        wallMounted: placementWall || undefined,
        ceilingMounted: placementCeiling || undefined,
      },
      collision: {
        enabled: collisionEnabled,
        clearanceFrontMm: clearanceFront > 0 ? clearanceFront : undefined,
      },
      provenance: {
        sourceName: sourceName.trim(),
        license: license.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        author: author.trim() || undefined,
      },
      manufacturer: manufacturer.trim() || undefined,
      sku: sku.trim() || undefined,
      tags: tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };
    try {
      const { warnings: uploadWarnings } = await createSceneAssetDefinitionMultipart({
        metadata,
        model: modelFile,
        thumbnail: thumbnailFile,
        // Only send `scope` if admin — the server ignores it for
        // non-admins anyway, but omitting it altogether keeps the
        // request shape minimal for typical users.
        scope: isPlatformAdmin ? scope : undefined,
      });
      if (uploadWarnings.length > 0) {
        setWarnings(uploadWarnings);
      }
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-xl shadow-xl"
        style={{ background: "#141519", border: "1px solid #2E3240" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <h2 className="text-white font-semibold">Add Asset</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Files */}
          <section className="grid grid-cols-2 gap-3">
            <FilePicker
              label="3D model (GLB)"
              hint="Required · .glb or .gltf"
              value={modelFile}
              error={modelError}
              onPick={handleModelPick}
              accept=".glb,.gltf"
            />
            <FilePicker
              label="Thumbnail"
              hint="Optional · .webp preferred"
              value={thumbnailFile}
              error={thumbnailError}
              onPick={handleThumbnailPick}
              accept=".webp,.png,.jpg,.jpeg"
            />
          </section>

          {/* Basic */}
          <section className="space-y-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "36" Refrigerator"'
                className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
              />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SceneAssetCategory)}
                className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SCENE_ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SCENE_ASSET_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          {/* Availability — platform admin only. Non-admin uploads are
              always scoped to the caller's organization (server enforced). */}
          {isPlatformAdmin && (
            <section>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                Availability
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption
                  active={scope === "system"}
                  onClick={() => setScope("system")}
                  title="CabinetFlow Library"
                  hint="Available to every organization"
                />
                <ScopeOption
                  active={scope === "org"}
                  onClick={() => setScope("org")}
                  title="My Organization"
                  hint="Visible only to my organization"
                />
              </div>
            </section>
          )}

          {/* Dimensions */}
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Dimensions (mm)
              {probing && (
                <span className="ml-2 text-gray-500 normal-case">probing GLB…</span>
              )}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="Width" value={widthMm} onChange={setWidthMm} />
              <NumberInput label="Height" value={heightMm} onChange={setHeightMm} />
              <NumberInput label="Depth" value={depthMm} onChange={setDepthMm} />
            </div>
            {probeNote && (
              <p className="mt-1 text-[11px]" style={{ color: "#9A9288" }}>
                {probeNote}
              </p>
            )}
          </section>

          {/* Placement */}
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Placement</p>
            <div className="grid grid-cols-3 gap-2 text-sm text-gray-300">
              <Checkbox
                label="Floor"
                checked={placementFloor}
                onChange={setPlacementFloor}
              />
              <Checkbox
                label="Wall"
                checked={placementWall}
                onChange={setPlacementWall}
              />
              <Checkbox
                label="Ceiling"
                checked={placementCeiling}
                onChange={setPlacementCeiling}
              />
            </div>
          </section>

          {/* Collision */}
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Collision</p>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Checkbox
                label="Enable collision"
                checked={collisionEnabled}
                onChange={setCollisionEnabled}
              />
              <NumberInput
                label="Front clearance (mm)"
                value={clearanceFront}
                onChange={setClearanceFront}
                min={0}
              />
            </div>
          </section>

          {/* Provenance */}
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              License + source <span className="text-gray-600 normal-case">(required for GLBs)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="License">
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder='e.g. "CC0-1.0" or "In-house / proprietary"'
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Source name">
                <input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder='e.g. "Poly Haven", "In-house"'
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Source URL (optional)">
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Author (optional)">
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
            </div>
          </section>

          {/* Cataloging */}
          <section>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cataloging (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Manufacturer">
                <input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="SKU">
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Tags (comma-separated)">
                <input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="e.g. modern, energy-star"
                  className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
            </div>
          </section>

          {/* Errors / warnings */}
          {error && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: "rgba(220,60,60,0.10)",
                border: "1px solid #6a2828",
                color: "#e07070",
              }}
            >
              {error}
            </div>
          )}
          {warnings.length > 0 && (
            <ul
              className="rounded-md px-3 py-2 text-xs space-y-0.5"
              style={{
                background: "rgba(200,133,42,0.08)",
                border: "1px solid #6a5828",
                color: "#c8852a",
              }}
            >
              {warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-surface-200">
          {/* Missing-fields hint — makes the disabled Upload button
              self-explanatory instead of silently unclickable. */}
          <div className="text-[11px] text-gray-500 min-h-[16px] flex-1 truncate">
            {missing.length > 0 && !submitting && (
              <span style={{ color: "#c8852a" }}>
                Missing: {missing.join(", ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={!isValid || submitting}
              title={!isValid && missing.length > 0 ? `Missing: ${missing.join(", ")}` : undefined}
              className="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md transition-colors"
            >
              {submitting ? "Uploading…" : "Upload Asset"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        step={1}
        min={min}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 tabular-nums"
      />
    </div>
  );
}

function ScopeOption({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-md px-3 py-2 transition-colors"
      style={{
        background: active ? "rgba(200,133,42,0.10)" : "#1A1E26",
        border: active ? "1px solid #c8852a" : "1px solid #2E3240",
      }}
    >
      <p className="text-sm text-white">{title}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>
    </button>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brand-500"
      />
      {label}
    </label>
  );
}

function FilePicker({
  label,
  hint,
  value,
  error,
  onPick,
  accept,
}: {
  label: string;
  hint: string;
  value: File | null;
  error: string | null;
  onPick: (f: File | null) => void;
  accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!dragActive) return;
    const off = () => setDragActive(false);
    window.addEventListener("dragend", off);
    window.addEventListener("drop", off);
    return () => {
      window.removeEventListener("dragend", off);
      window.removeEventListener("drop", off);
    };
  }, [dragActive]);

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const f = e.dataTransfer.files[0];
          if (f) void onPick(f);
        }}
        onClick={() => inputRef.current?.click()}
        className="rounded-md px-3 py-4 cursor-pointer text-center transition-colors"
        style={{
          background: dragActive ? "rgba(200,133,42,0.10)" : "#1A1E26",
          border: dragActive ? "1px dashed #c8852a" : "1px dashed #2E3240",
          color: value ? "#fff" : "#9A9288",
        }}
      >
        {value ? (
          <>
            <p className="text-sm truncate">{value.name}</p>
            <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">
              {(value.size / 1024).toFixed(0)} KB
            </p>
          </>
        ) : (
          <>
            <p className="text-sm">Drop or click to select</p>
            <p className="text-[10px] mt-0.5">{hint}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <p className="mt-1 text-[10px]" style={{ color: "#e07070" }}>
          {error}
        </p>
      )}
    </div>
  );
}
