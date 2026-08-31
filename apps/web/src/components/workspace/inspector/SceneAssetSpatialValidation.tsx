"use client";

import { useMemo } from "react";
import {
  detectSceneAssetVsCabinet,
  getRoomArchitecture,
  validateAssetAgainstArchitecture,
  validateSceneAssetPlacement,
  type RoomBoundsMm,
  type SceneAssetDefinition,
  type SceneAssetInstance,
} from "@woodcraft/shared";
import { useSceneAssetsStore } from "@/store/sceneAssets";
import { useEditorStore } from "@/store/editor";

// Inline spatial-validation section for the Scene Asset inspector.
//
// Aggregates warnings from three sources — kept visually distinguishable
// via the `title` attribute + source tag:
//   · scene         — room-bounds + scene-asset ↔ scene-asset overlap +
//                     clearance (Slice-6 spatial engine)
//   · architecture  — asset ↔ solid-wall + asset outside floor footprint
//                     (Room Architecture Engine spatial bridge)
//   · cabinet       — asset ↔ cabinet overlap warnings
//
// Never blocks the user. All architecture/cabinet issues are warnings.

interface Props {
  instance: SceneAssetInstance;
  definition: SceneAssetDefinition;
}

interface DisplayIssue {
  key: string;
  source: string;
  severity: string;
  code: string;
  message: string;
}

export function SceneAssetSpatialValidation({ instance, definition }: Props) {
  const rooms = useEditorStore((s) => s.rooms);
  const cabinets = useEditorStore((s) => s.cabinets);
  const allInstances = useSceneAssetsStore((s) => s.instances);
  const definitions = useSceneAssetsStore((s) => s.definitions);

  const room = rooms.find((r) => r.id === instance.roomId);

  const otherInstances = useMemo(
    () => allInstances.filter((i) => i.id !== instance.id && i.roomId === instance.roomId),
    [allInstances, instance.id, instance.roomId],
  );

  const definitionsById = useMemo(() => {
    const m = new Map<string, SceneAssetDefinition>();
    for (const d of definitions) m.set(d.id, d);
    return m;
  }, [definitions]);

  const roomBounds: RoomBoundsMm | null = useMemo(
    () =>
      room
        ? {
            widthMm: Number(room.width),
            heightMm: Number(room.height),
            depthMm: Number(room.depth),
          }
        : null,
    [room],
  );

  const architecture = useMemo(
    () => (room ? getRoomArchitecture(room) : null),
    [room],
  );

  const issues: DisplayIssue[] = useMemo(() => {
    const out: DisplayIssue[] = [];
    if (roomBounds) {
      const sceneIssues = validateSceneAssetPlacement({
        instance,
        definition,
        room: roomBounds,
        otherInstances,
        getDefinition: (id) => definitionsById.get(id),
      });
      for (let i = 0; i < sceneIssues.length; i++) {
        const iss = sceneIssues[i]!;
        out.push({
          key: `scene:${iss.code}:${iss.targetInstanceId ?? "self"}:${i}`,
          source: iss.source,
          severity: iss.severity,
          code: iss.code,
          message: iss.message,
        });
      }
    }
    if (architecture) {
      const archIssues = validateAssetAgainstArchitecture({
        instance,
        definition,
        architecture,
      });
      for (let i = 0; i < archIssues.length; i++) {
        const iss = archIssues[i]!;
        out.push({
          key: `arch:${iss.code}:${iss.wallId ?? "-"}:${i}`,
          source: iss.source,
          severity: iss.severity,
          code: iss.code,
          message: iss.message,
        });
      }
    }
    // Cabinet bridge — only meaningful when this instance shares a room
    // with cabinets. The editor store already loads cabinets per selected
    // room, so a simple filter by roomId keeps stale cross-room warnings
    // out.
    const roomCabinets = cabinets.filter((c) => c.roomId === instance.roomId);
    if (roomCabinets.length > 0) {
      const cabIssues = detectSceneAssetVsCabinet({
        instance,
        definition,
        cabinets: roomCabinets,
      });
      for (let i = 0; i < cabIssues.length; i++) {
        const iss = cabIssues[i]!;
        out.push({
          key: `cab:${iss.code}:${iss.cabinetId ?? "-"}:${i}`,
          source: iss.source,
          severity: iss.severity,
          code: iss.code,
          message: iss.message,
        });
      }
    }
    return out;
  }, [
    roomBounds,
    architecture,
    instance,
    definition,
    otherInstances,
    definitionsById,
    cabinets,
  ]);

  if (!roomBounds) return null;

  return (
    <section>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
        Spatial
        <span className="ml-1 text-gray-600 normal-case">
          (scene · architecture · cabinet)
        </span>
      </p>
      {issues.length === 0 ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px] flex items-center gap-1.5"
          style={{
            background: "rgba(60, 160, 60, 0.08)",
            border: "1px solid #1f4a1f",
            color: "#7fbf7f",
          }}
        >
          <span aria-hidden>✓</span>
          <span>Fits inside room; no overlaps.</span>
        </div>
      ) : (
        <ul className="space-y-1">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className="rounded-md px-2 py-1.5 text-[11px] flex items-start gap-1.5"
              style={{
                background: "rgba(200, 133, 42, 0.08)",
                border: "1px solid #6a5828",
                color: "#c8852a",
              }}
              title={`source=${issue.source} severity=${issue.severity} code=${issue.code}`}
            >
              <span aria-hidden className="mt-px">⚠</span>
              <span className="min-w-0">
                <span
                  className="mr-1 uppercase tracking-wider text-[9px]"
                  style={{ color: "#8a8080" }}
                >
                  [{issue.source}]
                </span>
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
