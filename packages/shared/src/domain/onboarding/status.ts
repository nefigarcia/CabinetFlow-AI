// Onboarding activation status — DERIVED from existing organization data
// (Client / Project / Room / Cabinet). There is deliberately no stored
// onboarding flag: activation means "the org has at least one cabinet",
// so this can never drift from the real records.

export interface OnboardingCounts {
  clients: number;
  projects: number;
  rooms: number;
  cabinets: number;
}

export interface OnboardingStatus {
  activated: boolean;
  counts: OnboardingCounts;
  firstProject: { id: string; name: string } | null;
  firstRoomId: string | null;
  steps: {
    account: true;
    project: boolean;
    room: boolean;
    cabinet: boolean;
  };
}

export function deriveOnboardingStatus(input: {
  counts: OnboardingCounts;
  firstProject: { id: string; name: string } | null;
  firstRoomId: string | null;
}): OnboardingStatus {
  const { counts } = input;
  return {
    activated: counts.cabinets > 0,
    counts,
    firstProject: input.firstProject,
    firstRoomId: input.firstRoomId,
    steps: {
      account: true,
      project: counts.projects > 0,
      room: counts.rooms > 0,
      cabinet: counts.cabinets > 0,
    },
  };
}

// ─── Persistence seam ─────────────────────────────────────────────────
//
// Structural subset of the Prisma client used by the status query. The
// API passes its real `prisma`; tests pass an in-memory fake. Every
// query carries `orgId`, and room / cabinet counts are ALSO scoped
// through their parent relations so a mis-tagged row can't leak in.

type Rel = { orgId: string };

export interface OnboardingStatusDb {
  client: {
    count(args: { where: { orgId: string } }): PromiseLike<number>;
  };
  project: {
    count(args: { where: { orgId: string } }): PromiseLike<number>;
    findFirst(args: {
      where: { orgId: string };
      orderBy: { createdAt: "asc" };
      select: { id: true; name: true };
    }): PromiseLike<{ id: string; name: string } | null>;
  };
  room: {
    count(args: { where: { orgId: string; project: Rel } }): PromiseLike<number>;
    findFirst(args: {
      where: { orgId: string; projectId: string };
      orderBy: { createdAt: "asc" };
      select: { id: true };
    }): PromiseLike<{ id: string } | null>;
  };
  cabinet: {
    count(args: {
      where: { orgId: string; room: { orgId: string; project: Rel } };
    }): PromiseLike<number>;
  };
}

export async function loadOnboardingStatus(
  db: OnboardingStatusDb,
  orgId: string,
): Promise<OnboardingStatus> {
  const [clients, projects, rooms, cabinets, firstProject] = await Promise.all([
    db.client.count({ where: { orgId } }),
    db.project.count({ where: { orgId } }),
    db.room.count({ where: { orgId, project: { orgId } } }),
    db.cabinet.count({ where: { orgId, room: { orgId, project: { orgId } } } }),
    db.project.findFirst({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const firstRoom = firstProject
    ? await db.room.findFirst({
        where: { orgId, projectId: firstProject.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    : null;

  return deriveOnboardingStatus({
    counts: { clients, projects, rooms, cabinets },
    firstProject: firstProject ? { id: firstProject.id, name: firstProject.name } : null,
    firstRoomId: firstRoom?.id ?? null,
  });
}
