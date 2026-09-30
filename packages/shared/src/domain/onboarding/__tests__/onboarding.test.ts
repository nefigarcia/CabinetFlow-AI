import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_ROOM_DIMENSIONS_MM,
  QUICK_START_DEFAULT_ROOM_NAME,
  deriveOnboardingStatus,
  loadOnboardingStatus,
  quickStartSchema,
  resolveQuickStartRoomName,
  runQuickStart,
  type OnboardingStatusDb,
  type QuickStartDb,
  type QuickStartTx,
} from "..";
import { canMutateDesignContent } from "../../systems/authz";

// ═══════════════════════════════════════════════════════════════════════
// First-run onboarding — /api/onboarding/status + /api/onboarding/quick-start
//
// No DB / HTTP harness in this repo's test setup: the org-scoped query +
// transaction logic lives in this shared module behind a structural DB
// seam (the API passes its real Prisma client), so it is exercised here
// against an in-memory fake that honours the same `where` filters and
// all-or-nothing transaction semantics. Route wiring (auth guard, 422,
// org from context) is asserted on the route source, matching the
// existing authorization tests.
// ═══════════════════════════════════════════════════════════════════════

// ─── In-memory fake DB ────────────────────────────────────────────────

interface Row { id: string; orgId: string; createdAt: number; name: string }
interface ProjectRow extends Row { clientId: string }
interface RoomRow extends Row { projectId: string; width: number; height: number; depth: number }
interface CabinetRow extends Row { roomId: string }
interface Tables { clients: Row[]; projects: ProjectRow[]; rooms: RoomRow[]; cabinets: CabinetRow[] }

function makeDb(seed: Partial<Tables> = {}, opts: { failOn?: "client" | "project" | "room" } = {}) {
  let t: Tables = {
    clients: [...(seed.clients ?? [])],
    projects: [...(seed.projects ?? [])],
    rooms: [...(seed.rooms ?? [])],
    cabinets: [...(seed.cabinets ?? [])],
  };
  let seq = 1000;
  const nextId = (p: string) => `${p}_${++seq}`;

  const projectOf = (id: string) => t.projects.find((p) => p.id === id);
  const roomOf = (id: string) => t.rooms.find((r) => r.id === id);
  const roomMatches = (r: RoomRow, w: { orgId: string; projectId?: string; project?: { orgId: string } }) =>
    r.orgId === w.orgId &&
    (w.projectId === undefined || r.projectId === w.projectId) &&
    (w.project === undefined || projectOf(r.projectId)?.orgId === w.project.orgId);
  const byCreated = <T extends Row>(rows: T[]) => [...rows].sort((a, b) => a.createdAt - b.createdAt);

  const statusDb: OnboardingStatusDb = {
    client: { count: async ({ where }) => t.clients.filter((c) => c.orgId === where.orgId).length },
    project: {
      count: async ({ where }) => t.projects.filter((p) => p.orgId === where.orgId).length,
      findFirst: async ({ where }) => {
        const p = byCreated(t.projects.filter((x) => x.orgId === where.orgId))[0];
        return p ? { id: p.id, name: p.name } : null;
      },
    },
    room: {
      count: async ({ where }) => t.rooms.filter((r) => roomMatches(r, where)).length,
      findFirst: async ({ where }) => {
        const r = byCreated(t.rooms.filter((x) => roomMatches(x, where)))[0];
        return r ? { id: r.id } : null;
      },
    },
    cabinet: {
      count: async ({ where }) =>
        t.cabinets.filter((c) => {
          const room = roomOf(c.roomId);
          return c.orgId === where.orgId && !!room && roomMatches(room, where.room);
        }).length,
    },
  };

  const tx: QuickStartTx = {
    client: {
      create: async ({ data }) => {
        if (opts.failOn === "client") throw new Error("client insert failed");
        const row = { id: nextId("cl"), createdAt: ++seq, ...data };
        t.clients.push(row);
        return { id: row.id, name: row.name };
      },
    },
    project: {
      create: async ({ data }) => {
        if (opts.failOn === "project") throw new Error("project insert failed");
        const row = { id: nextId("pr"), createdAt: ++seq, ...data };
        t.projects.push(row);
        return { id: row.id, name: row.name };
      },
    },
    room: {
      create: async ({ data }) => {
        if (opts.failOn === "room") throw new Error("room insert failed");
        const row = { id: nextId("rm"), createdAt: ++seq, ...data };
        t.rooms.push(row);
        return { id: row.id, name: row.name, projectId: row.projectId };
      },
    },
  };

  let transactions = 0;
  const quickDb: QuickStartDb = {
    async $transaction(fn) {
      transactions++;
      const snapshot: Tables = {
        clients: [...t.clients], projects: [...t.projects], rooms: [...t.rooms], cabinets: [...t.cabinets],
      };
      try {
        return await fn(tx);
      } catch (e) {
        t = snapshot; // rollback
        throw e;
      }
    },
  };

  return { statusDb, quickDb, tables: () => t, transactions: () => transactions };
}

const ORG_A = "org_a";
const ORG_B = "org_b";

// Org B has a full design; org A starts empty unless seeded.
const ORG_B_SEED: Partial<Tables> = {
  clients: [{ id: "cb", orgId: ORG_B, createdAt: 1, name: "B client" }],
  projects: [{ id: "pb", orgId: ORG_B, createdAt: 2, name: "B project", clientId: "cb" }],
  rooms: [{ id: "rb", orgId: ORG_B, createdAt: 3, name: "B room", projectId: "pb", width: 1, height: 1, depth: 1 }],
  cabinets: [{ id: "kb", orgId: ORG_B, createdAt: 4, name: "B cab", roomId: "rb" }],
};

// ─── Status derivation ────────────────────────────────────────────────

describe("deriveOnboardingStatus", () => {
  const zero = { clients: 0, projects: 0, rooms: 0, cabinets: 0 };

  it("activated ⇔ cabinets > 0", () => {
    expect(deriveOnboardingStatus({ counts: zero, firstProject: null, firstRoomId: null }).activated).toBe(false);
    expect(
      deriveOnboardingStatus({ counts: { ...zero, projects: 1, rooms: 1 }, firstProject: null, firstRoomId: null }).activated,
    ).toBe(false);
    expect(
      deriveOnboardingStatus({ counts: { ...zero, cabinets: 1 }, firstProject: null, firstRoomId: null }).activated,
    ).toBe(true);
  });

  it("steps mirror counts; account is always true", () => {
    const s = deriveOnboardingStatus({
      counts: { clients: 1, projects: 1, rooms: 0, cabinets: 0 },
      firstProject: { id: "p", name: "P" },
      firstRoomId: null,
    });
    expect(s.steps).toEqual({ account: true, project: true, room: false, cabinet: false });
  });
});

describe("loadOnboardingStatus — org-scoped", () => {
  it("no projects → unactivated, nothing from other orgs leaks in", async () => {
    const { statusDb } = makeDb(ORG_B_SEED);
    const s = await loadOnboardingStatus(statusDb, ORG_A);
    expect(s.activated).toBe(false);
    expect(s.counts).toEqual({ clients: 0, projects: 0, rooms: 0, cabinets: 0 });
    expect(s.firstProject).toBeNull();
    expect(s.firstRoomId).toBeNull();
    expect(s.steps).toEqual({ account: true, project: false, room: false, cabinet: false });
  });

  it("project + room but no cabinets → unactivated with Continue target", async () => {
    const { statusDb } = makeDb({
      ...ORG_B_SEED,
      clients: [...ORG_B_SEED.clients!, { id: "ca", orgId: ORG_A, createdAt: 10, name: "A client" }],
      projects: [...ORG_B_SEED.projects!, { id: "pa", orgId: ORG_A, createdAt: 11, name: "A project", clientId: "ca" }],
      rooms: [...ORG_B_SEED.rooms!, { id: "ra", orgId: ORG_A, createdAt: 12, name: "Kitchen", projectId: "pa", width: 1, height: 1, depth: 1 }],
    });
    const s = await loadOnboardingStatus(statusDb, ORG_A);
    expect(s.activated).toBe(false);
    expect(s.counts).toEqual({ clients: 1, projects: 1, rooms: 1, cabinets: 0 });
    expect(s.firstProject).toEqual({ id: "pa", name: "A project" });
    expect(s.firstRoomId).toBe("ra");
  });

  it("cabinet exists → activated", async () => {
    const { statusDb } = makeDb(ORG_B_SEED);
    const s = await loadOnboardingStatus(statusDb, ORG_B);
    expect(s.activated).toBe(true);
    expect(s.counts.cabinets).toBe(1);
  });

  it("firstProject is the org's EARLIEST project and always belongs to the caller's org", async () => {
    const { statusDb } = makeDb({
      projects: [
        { id: "b_old", orgId: ORG_B, createdAt: 1, name: "B oldest", clientId: "x" },
        { id: "a_new", orgId: ORG_A, createdAt: 9, name: "A newer", clientId: "x" },
        { id: "a_old", orgId: ORG_A, createdAt: 5, name: "A older", clientId: "x" },
      ],
    });
    const s = await loadOnboardingStatus(statusDb, ORG_A);
    expect(s.firstProject).toEqual({ id: "a_old", name: "A older" });
  });

  it("cabinets / rooms are also scoped through their parent relations", async () => {
    // A cabinet tagged org A but sitting in an org-B room (corrupt row)
    // must not activate org A.
    const { statusDb } = makeDb({
      ...ORG_B_SEED,
      cabinets: [...ORG_B_SEED.cabinets!, { id: "bad", orgId: ORG_A, createdAt: 5, name: "x", roomId: "rb" }],
      rooms: [...ORG_B_SEED.rooms!, { id: "badroom", orgId: ORG_A, createdAt: 6, name: "x", projectId: "pb", width: 1, height: 1, depth: 1 }],
    });
    const s = await loadOnboardingStatus(statusDb, ORG_A);
    expect(s.counts.cabinets).toBe(0);
    expect(s.counts.rooms).toBe(0);
    expect(s.activated).toBe(false);
  });
});

// ─── Quick Start ──────────────────────────────────────────────────────

describe("quickStartSchema", () => {
  it("trims names and accepts an omitted room", () => {
    const r = quickStartSchema.safeParse({ clientName: "  Smith  ", projectName: " Kitchen Remodel " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ clientName: "Smith", projectName: "Kitchen Remodel" });
  });

  it.each([
    [{}],
    [{ clientName: "", projectName: "P" }],
    [{ clientName: "   ", projectName: "P" }],
    [{ clientName: "C", projectName: "  " }],
    [{ clientName: "C" }],
    [{ clientName: 5, projectName: "P" }],
    [{ clientName: "C", projectName: "P", roomName: "x".repeat(256) }],
  ])("rejects invalid input %j (route → 422)", (input) => {
    expect(quickStartSchema.safeParse(input).success).toBe(false);
  });

  it("blank / omitted room name → Kitchen", () => {
    expect(QUICK_START_DEFAULT_ROOM_NAME).toBe("Kitchen");
    expect(resolveQuickStartRoomName(undefined)).toBe("Kitchen");
    expect(resolveQuickStartRoomName("   ")).toBe("Kitchen");
    expect(resolveQuickStartRoomName(" Laundry ")).toBe("Laundry");
  });
});

describe("runQuickStart — atomic Client + Project + Room", () => {
  it("creates all three in the caller's org, linked, with default room dims — and no cabinet", async () => {
    const db = makeDb(ORG_B_SEED);
    const res = await runQuickStart(db.quickDb, ORG_A, { clientName: "Smith", projectName: "Kitchen Remodel" });

    const t = db.tables();
    const client = t.clients.find((c) => c.id === res.client.id)!;
    const project = t.projects.find((p) => p.id === res.project.id)!;
    const room = t.rooms.find((r) => r.id === res.room.id)!;

    expect(db.transactions()).toBe(1);
    expect([client.orgId, project.orgId, room.orgId]).toEqual([ORG_A, ORG_A, ORG_A]);
    expect(project.clientId).toBe(client.id);
    expect(room.projectId).toBe(project.id);
    expect(res.room.projectId).toBe(project.id);
    expect(room.name).toBe("Kitchen");
    expect({ width: room.width, height: room.height, depth: room.depth }).toEqual(DEFAULT_ROOM_DIMENSIONS_MM);
    expect(DEFAULT_ROOM_DIMENSIONS_MM).toEqual({ width: 4800, height: 2400, depth: 5400 });
    // No cabinet created; org B untouched.
    expect(t.cabinets).toEqual(ORG_B_SEED.cabinets);
    expect(t.clients.filter((c) => c.orgId === ORG_B)).toEqual(ORG_B_SEED.clients);
  });

  it("returns only the fields the frontend needs", async () => {
    const db = makeDb();
    const res = await runQuickStart(db.quickDb, ORG_A, { clientName: "C", projectName: "P", roomName: "Laundry" });
    expect(Object.keys(res.client).sort()).toEqual(["id", "name"]);
    expect(Object.keys(res.project).sort()).toEqual(["id", "name"]);
    expect(Object.keys(res.room).sort()).toEqual(["id", "name", "projectId"]);
    expect(res.room.name).toBe("Laundry");
  });

  it.each(["client", "project", "room"] as const)(
    "a failing %s insert rolls back every write (no partial onboarding data)",
    async (failOn) => {
      const db = makeDb(ORG_B_SEED, { failOn });
      await expect(
        runQuickStart(db.quickDb, ORG_A, { clientName: "C", projectName: "P" }),
      ).rejects.toThrow(`${failOn} insert failed`);
      const t = db.tables();
      expect(t.clients).toEqual(ORG_B_SEED.clients);
      expect(t.projects).toEqual(ORG_B_SEED.projects);
      expect(t.rooms).toEqual(ORG_B_SEED.rooms);
    },
  );

  it("after quick start the org is NOT yet activated (project, no cabinet)", async () => {
    const db = makeDb();
    await runQuickStart(db.quickDb, ORG_A, { clientName: "C", projectName: "P" });
    const s = await loadOnboardingStatus(db.statusDb, ORG_A);
    expect(s.activated).toBe(false);
    expect(s.steps).toEqual({ account: true, project: true, room: true, cabinet: false });
    expect(s.firstRoomId).not.toBeNull();
  });
});

// ─── Route wiring ─────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const API = resolve(HERE, "../../../../../../apps/api/src/app/api/onboarding");
const src = (rel: string) => readFileSync(resolve(API, rel), "utf8");

describe("GET /api/onboarding/status — wiring", () => {
  const body = src("status/route.ts");

  it("is read-only (GET only)", () => {
    expect(body).toMatch(/export async function GET\(/);
    expect(body).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)\(/);
  });

  it("uses the org from the auth context and the shared org-scoped loader", () => {
    expect(body).toMatch(/const \{ orgId \} = getContext\(req\);/);
    expect(body).toMatch(/if \(!orgId\) return apiError\("Unauthorized", 401\);/);
    expect(body).toMatch(/loadOnboardingStatus\(prisma, orgId\)/);
  });
});

describe("POST /api/onboarding/quick-start — wiring", () => {
  const body = src("quick-start/route.ts");

  it.each([["owner", true], ["admin", true], ["designer", true], ["viewer", false], [undefined, false]])(
    "design-content policy: %s → %s (viewer → 403)",
    (role, allowed) => {
      expect(canMutateDesignContent(role as string | undefined)).toBe(allowed);
    },
  );

  it("guards with the shared design-content predicate → 403 FORBIDDEN before any I/O", () => {
    expect(body).toMatch(
      /if \(!canMutateDesignContent\(role\)\) \{\s*return apiError\(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE\);/,
    );
    expect(body.search(/\bawait\b/)).toBeGreaterThan(body.indexOf("canMutateDesignContent(role)"));
    expect(body).not.toMatch(/role\s*[!=]==\s*"/); // no hand-written role strings
  });

  it("validates with quickStartSchema → 422 VALIDATION_ERROR", () => {
    expect(body).toMatch(/parseBody\(quickStartSchema, body\)/);
    expect(body).toMatch(/if \(!parsed\.success\) return apiError\(parsed\.error, 422, "VALIDATION_ERROR"\);/);
  });

  it("delegates to the transactional service with the context org; no direct writes", () => {
    expect(body).toMatch(/runQuickStart\(prisma, orgId, parsed\.data\)/);
    expect(body).not.toMatch(/prisma\.\w+\.(create|update|delete|upsert)/);
  });

  it("the service performs every write inside prisma.$transaction — client, project, room only", () => {
    const svc = readFileSync(resolve(HERE, "../quick-start.ts"), "utf8");
    expect(svc).toMatch(/return db\.\$transaction\(async \(tx\) => \{/);
    expect(svc).not.toMatch(/\bdb\.\w+\.\w+\(/); // nothing outside the transaction
    const writes = [...svc.matchAll(/\btx\.(\w+)\.(\w+)\(/g)].map((m) => `${m[1]}.${m[2]}`);
    expect(writes).toEqual(["client.create", "project.create", "room.create"]);
  });
});
