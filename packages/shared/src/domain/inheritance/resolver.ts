import type {
  CabinetDesign,
  CabinetOverrides,
  DesignDefaults,
  ProfileRef,
  RoomDesign,
} from "../design-document";
import type { ConstructionProfile } from "../profiles/construction";
import type { HardwareProfile } from "../profiles/hardware";
import type { MaterialProfile } from "../profiles/material";

// The inheritance model resolves an effective configuration for a single
// cabinet by walking:
//
//     Organization → Project → Room → Cabinet
//
// At each level, a full profile REFERENCE may be substituted (choosing a
// different construction/material/hardware profile entirely). At the CABINET
// level only, a sparse OVERRIDE map may layer field-level changes on top of
// the resolved profile.
//
// Parent inputs are never mutated. The returned `sources` map tells the
// caller exactly where each part of the effective configuration came from
// so the UI can display "Inherited from project" / "Overridden on this
// cabinet" annotations.

export type ResolutionLevel = "organization" | "project" | "room" | "cabinet";

export interface ResolutionSource {
  level: ResolutionLevel;
  profileId?: string;
  profileVersion?: number;
}

export interface FieldSource {
  level: ResolutionLevel;
  /** Present when the value came from an overlaid cabinet override. */
  fromOverride?: boolean;
}

export interface ProfileRegistry {
  construction(ref: ProfileRef): ConstructionProfile | undefined;
  material(ref: ProfileRef): MaterialProfile | undefined;
  hardware(ref: ProfileRef): HardwareProfile | undefined;
}

export interface OrganizationDefaults {
  id: string;
  defaults?: DesignDefaults;
}

export interface ProjectDefaults {
  id: string;
  defaults?: DesignDefaults;
}

export interface ResolutionInput {
  organization?: OrganizationDefaults;
  project?: ProjectDefaults;
  room?: Pick<RoomDesign, "id" | "defaults">;
  cabinet: Pick<
    CabinetDesign,
    | "id"
    | "constructionProfileRef"
    | "materialProfileRef"
    | "hardwareProfileRef"
    | "overrides"
  >;
  profiles: ProfileRegistry;
}

export interface ResolvedConfiguration {
  effective: {
    construction?: ConstructionProfile;
    material?: MaterialProfile;
    hardware?: HardwareProfile;
  };
  sources: {
    constructionRef?: ResolutionSource;
    materialRef?: ResolutionSource;
    hardwareRef?: ResolutionSource;
    overrides: {
      construction?: Record<string, FieldSource>;
      material?: Record<string, FieldSource>;
      hardware?: Record<string, FieldSource>;
    };
  };
}

// ── Ref selection ────────────────────────────────────────────────────────────

interface RefCandidate {
  level: ResolutionLevel;
  ref?: ProfileRef;
}

function selectConstructionRef(input: ResolutionInput): RefCandidate | undefined {
  const chain: RefCandidate[] = [
    { level: "organization", ref: input.organization?.defaults?.constructionProfileRef },
    { level: "project", ref: input.project?.defaults?.constructionProfileRef },
    { level: "room", ref: input.room?.defaults?.constructionProfileRef },
    { level: "cabinet", ref: input.cabinet.constructionProfileRef },
  ];
  return pickLast(chain);
}

function selectMaterialRef(input: ResolutionInput): RefCandidate | undefined {
  const chain: RefCandidate[] = [
    { level: "organization", ref: input.organization?.defaults?.materialProfileRef },
    { level: "project", ref: input.project?.defaults?.materialProfileRef },
    { level: "room", ref: input.room?.defaults?.materialProfileRef },
    { level: "cabinet", ref: input.cabinet.materialProfileRef },
  ];
  return pickLast(chain);
}

function selectHardwareRef(input: ResolutionInput): RefCandidate | undefined {
  const chain: RefCandidate[] = [
    { level: "organization", ref: input.organization?.defaults?.hardwareProfileRef },
    { level: "project", ref: input.project?.defaults?.hardwareProfileRef },
    { level: "room", ref: input.room?.defaults?.hardwareProfileRef },
    { level: "cabinet", ref: input.cabinet.hardwareProfileRef },
  ];
  return pickLast(chain);
}

function pickLast(chain: RefCandidate[]): RefCandidate | undefined {
  let picked: RefCandidate | undefined;
  for (const c of chain) if (c.ref) picked = c;
  return picked;
}

// ── Immutable override merge ─────────────────────────────────────────────────

/**
 * Deep-merges `override` onto `base` returning a new object. Overrides may
 * only replace values at the LEAF level (booleans, numbers, strings) or
 * merge nested objects; arrays are replaced wholesale. Returns the source
 * map of top-level keys that came from the override.
 */
function applyOverride<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | undefined,
): { merged: T; overriddenKeys: Set<string> } {
  const overriddenKeys = new Set<string>();
  if (!override) return { merged: structuredCloneCompat(base), overriddenKeys };

  const merged = structuredCloneCompat(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    overriddenKeys.add(key);
    const baseValue = (merged as Record<string, unknown>)[key];
    if (
      isPlainObject(value) &&
      isPlainObject(baseValue) &&
      !Array.isArray(value) &&
      !Array.isArray(baseValue)
    ) {
      (merged as Record<string, unknown>)[key] = mergeDeep(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return { merged, overriddenKeys };
}

function mergeDeep(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = out[key];
    if (
      isPlainObject(value) &&
      isPlainObject(baseValue) &&
      !Array.isArray(value) &&
      !Array.isArray(baseValue)
    ) {
      out[key] = mergeDeep(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function structuredCloneCompat<T>(x: T): T {
  if (typeof structuredClone === "function") return structuredClone(x);
  return JSON.parse(JSON.stringify(x)) as T;
}

function markOverrideSources(
  keys: Set<string>,
): Record<string, FieldSource> | undefined {
  if (keys.size === 0) return undefined;
  const out: Record<string, FieldSource> = {};
  for (const key of keys) out[key] = { level: "cabinet", fromOverride: true };
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolves the effective construction / material / hardware configuration
 * for a cabinet by walking the inheritance chain and layering any cabinet-
 * level overrides on top. Parent inputs are not mutated.
 *
 * Callers with an unresolved profile reference (registry returned
 * `undefined`) receive an `effective` slot of `undefined` for that profile
 * type; downstream code must decide whether that is a validation error.
 */
export function resolveEffectiveConfiguration(
  input: ResolutionInput,
): ResolvedConfiguration {
  const constructionRef = selectConstructionRef(input);
  const materialRef = selectMaterialRef(input);
  const hardwareRef = selectHardwareRef(input);

  const overrides: CabinetOverrides | undefined = input.cabinet.overrides;

  const constructionBase = constructionRef?.ref
    ? input.profiles.construction(constructionRef.ref)
    : undefined;
  const materialBase = materialRef?.ref
    ? input.profiles.material(materialRef.ref)
    : undefined;
  const hardwareBase = hardwareRef?.ref
    ? input.profiles.hardware(hardwareRef.ref)
    : undefined;

  const constructionApplied = constructionBase
    ? applyOverride(
        constructionBase as unknown as Record<string, unknown>,
        overrides?.construction,
      )
    : undefined;
  const materialApplied = materialBase
    ? applyOverride(
        materialBase as unknown as Record<string, unknown>,
        overrides?.material,
      )
    : undefined;
  const hardwareApplied = hardwareBase
    ? applyOverride(
        hardwareBase as unknown as Record<string, unknown>,
        overrides?.hardware,
      )
    : undefined;

  return {
    effective: {
      construction: constructionApplied
        ? (constructionApplied.merged as unknown as ConstructionProfile)
        : undefined,
      material: materialApplied
        ? (materialApplied.merged as unknown as MaterialProfile)
        : undefined,
      hardware: hardwareApplied
        ? (hardwareApplied.merged as unknown as HardwareProfile)
        : undefined,
    },
    sources: {
      constructionRef: constructionRef
        ? {
            level: constructionRef.level,
            profileId: constructionRef.ref?.id,
            profileVersion: constructionRef.ref?.version,
          }
        : undefined,
      materialRef: materialRef
        ? {
            level: materialRef.level,
            profileId: materialRef.ref?.id,
            profileVersion: materialRef.ref?.version,
          }
        : undefined,
      hardwareRef: hardwareRef
        ? {
            level: hardwareRef.level,
            profileId: hardwareRef.ref?.id,
            profileVersion: hardwareRef.ref?.version,
          }
        : undefined,
      overrides: {
        construction: constructionApplied
          ? markOverrideSources(constructionApplied.overriddenKeys)
          : undefined,
        material: materialApplied
          ? markOverrideSources(materialApplied.overriddenKeys)
          : undefined,
        hardware: hardwareApplied
          ? markOverrideSources(hardwareApplied.overriddenKeys)
          : undefined,
      },
    },
  };
}
