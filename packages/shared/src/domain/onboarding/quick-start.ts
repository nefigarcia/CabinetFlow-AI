import { z } from "zod";

// Quick Start — first-run creation of Client + Project + initial Room as
// ONE atomic operation. Never creates cabinets, quotes, materials, CNC
// data, profiles, or organization defaults.

/** Default room shell (mm) — the values the New Project flow has always
 *  used for its auto-created room. */
export const DEFAULT_ROOM_DIMENSIONS_MM = { width: 4800, height: 2400, depth: 5400 } as const;

export const QUICK_START_DEFAULT_ROOM_NAME = "Kitchen";

export const quickStartSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required").max(255),
  projectName: z.string().trim().min(1, "Project name is required").max(255),
  // Blank / omitted → QUICK_START_DEFAULT_ROOM_NAME (applied in runQuickStart).
  roomName: z.string().trim().max(255).optional(),
});

export type QuickStartData = z.infer<typeof quickStartSchema>;

export function resolveQuickStartRoomName(roomName: string | undefined): string {
  const trimmed = roomName?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : QUICK_START_DEFAULT_ROOM_NAME;
}

export interface QuickStartResult {
  client: { id: string; name: string };
  project: { id: string; name: string };
  room: { id: string; name: string; projectId: string };
}

/** Structural subset of a Prisma interactive-transaction client. */
export interface QuickStartTx {
  client: {
    create(args: {
      data: { orgId: string; name: string };
      select: { id: true; name: true };
    }): PromiseLike<{ id: string; name: string }>;
  };
  project: {
    create(args: {
      data: { orgId: string; clientId: string; name: string };
      select: { id: true; name: true };
    }): PromiseLike<{ id: string; name: string }>;
  };
  room: {
    create(args: {
      data: {
        orgId: string;
        projectId: string;
        name: string;
        width: number;
        height: number;
        depth: number;
      };
      select: { id: true; name: true; projectId: true };
    }): PromiseLike<{ id: string; name: string; projectId: string }>;
  };
}

export interface QuickStartDb {
  $transaction<R>(fn: (tx: QuickStartTx) => Promise<R>): Promise<R>;
}

/** Creates Client → Project → Room inside one transaction. Any failure
 *  rolls back every write — no partial onboarding data. */
export async function runQuickStart(
  db: QuickStartDb,
  orgId: string,
  input: QuickStartData,
): Promise<QuickStartResult> {
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { orgId, name: input.clientName },
      select: { id: true, name: true },
    });
    const project = await tx.project.create({
      data: { orgId, clientId: client.id, name: input.projectName },
      select: { id: true, name: true },
    });
    const room = await tx.room.create({
      data: {
        orgId,
        projectId: project.id,
        name: resolveQuickStartRoomName(input.roomName),
        ...DEFAULT_ROOM_DIMENSIONS_MM,
      },
      select: { id: true, name: true, projectId: true },
    });
    return { client, project, room };
  });
}
