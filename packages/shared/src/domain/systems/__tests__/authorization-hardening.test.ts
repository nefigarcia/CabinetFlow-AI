import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  canAssignCabinetSystems,
  canManageOrganizationLibrary,
  canManageOrganizationStandards,
  canMutateDesignContent,
  canTransitionQuoteStatus,
  FORBIDDEN_MESSAGE_MANAGE_LIBRARY,
  FORBIDDEN_MESSAGE_QUOTE_DECISION,
  QUOTE_DECISION_STATUSES,
} from "../authz";

// ═══════════════════════════════════════════════════════════════════════
// Authorization hardening (post-3.1a).
//
// The API middleware authenticates (JWT → x-user-role) but enforces no
// role policy — every mutation handler guards itself. These handlers
// were authenticated but still writable by viewers (and, for org
// libraries, by designers).
//
//   canMutateDesignContent       owner/admin/designer  (viewer → 403)
//   canManageOrganizationLibrary owner/admin           (designer/viewer → 403)
//
// No HTTP harness in the shared package — as with the Phase 3.0 / 3.1a
// wiring tests, the route source is asserted: the guard lives INSIDE the
// handler and runs before any I/O (first `await`), so the 403 is
// resource-independent and never leaks cross-org existence.
// ═══════════════════════════════════════════════════════════════════════

const ROLES = ["owner", "admin", "designer", "viewer", undefined, null, "", "superuser"] as const;

describe("canMutateDesignContent — role matrix", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["designer", true],
    ["viewer", false],
    [undefined, false],
    [null, false],
    ["", false],
    ["superuser", false],
  ])("%s → %s", (role, allowed) => {
    expect(canMutateDesignContent(role as string | null | undefined)).toBe(allowed);
  });

  it("stays in lockstep with the cabinet-mutation predicate", () => {
    for (const r of ROLES) expect(canMutateDesignContent(r)).toBe(canAssignCabinetSystems(r));
  });
});

describe("canManageOrganizationLibrary — role matrix", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["designer", false],
    ["viewer", false],
    [undefined, false],
    [null, false],
    ["", false],
    ["superuser", false],
  ])("%s → %s", (role, allowed) => {
    expect(canManageOrganizationLibrary(role as string | null | undefined)).toBe(allowed);
  });

  it("stays in lockstep with the organization-standards predicate", () => {
    for (const r of ROLES) expect(canManageOrganizationLibrary(r)).toBe(canManageOrganizationStandards(r));
  });

  it("has a stable forbidden message", () => {
    expect(FORBIDDEN_MESSAGE_MANAGE_LIBRARY.length).toBeGreaterThan(0);
  });
});

// ─── Route wiring ─────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const API = resolve(HERE, "../../../../../../apps/api/src/app/api");
const P = (rel: string) => resolve(API, rel);

function handlerBody(path: string, method: string): string {
  const src = readFileSync(path, "utf8");
  const start = src.indexOf(`export async function ${method}(`);
  expect(start, `${method} handler in ${path}`).toBeGreaterThanOrEqual(0);
  const next = src.indexOf("export async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

type Tier = "design" | "library";

const PREDICATE: Record<Tier, { fn: string; message: string }> = {
  design: { fn: "canMutateDesignContent", message: "FORBIDDEN_MESSAGE_ASSIGN" },
  library: { fn: "canManageOrganizationLibrary", message: "FORBIDDEN_MESSAGE_MANAGE_LIBRARY" },
};

const HARDENED: Array<[label: string, path: string, method: string, tier: Tier]> = [
  // Phase 1 profiles — organization standards (owner/admin)
  ["Construction profile POST", P("profiles/construction/route.ts"), "POST", "library"],
  ["Construction profile PATCH", P("profiles/construction/[id]/route.ts"), "PATCH", "library"],
  ["Construction profile DELETE", P("profiles/construction/[id]/route.ts"), "DELETE", "library"],
  ["Material profile POST", P("profiles/material/route.ts"), "POST", "library"],
  ["Material profile PATCH", P("profiles/material/[id]/route.ts"), "PATCH", "library"],
  ["Material profile DELETE", P("profiles/material/[id]/route.ts"), "DELETE", "library"],
  ["Hardware profile POST", P("profiles/hardware/route.ts"), "POST", "library"],
  ["Hardware profile PATCH", P("profiles/hardware/[id]/route.ts"), "PATCH", "library"],
  ["Hardware profile DELETE", P("profiles/hardware/[id]/route.ts"), "DELETE", "library"],
  ["Organization profile defaults PATCH", P("organization/profiles/route.ts"), "PATCH", "library"],
  // Project / Room profile assignment — design content
  ["Project profiles PATCH", P("projects/[id]/profiles/route.ts"), "PATCH", "design"],
  ["Room profiles PATCH", P("projects/[id]/rooms/[roomId]/profiles/route.ts"), "PATCH", "design"],
  // Manual cabinet parts
  ["Cabinet part POST", P("projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/parts/route.ts"), "POST", "design"],
  ["Cabinet part PATCH", P("projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/parts/[partId]/route.ts"), "PATCH", "design"],
  ["Cabinet part DELETE", P("projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/parts/[partId]/route.ts"), "DELETE", "design"],
  // Projects / Rooms
  ["Project POST", P("projects/route.ts"), "POST", "design"],
  ["Project PATCH", P("projects/[id]/route.ts"), "PATCH", "design"],
  ["Room POST", P("projects/[id]/rooms/route.ts"), "POST", "design"],
  ["Room PATCH", P("projects/[id]/rooms/[roomId]/route.ts"), "PATCH", "design"],
  // Organization libraries
  ["Material POST", P("materials/route.ts"), "POST", "library"],
  ["Material PATCH", P("materials/[id]/route.ts"), "PATCH", "library"],
  ["Material DELETE", P("materials/[id]/route.ts"), "DELETE", "library"],
  ["Hardware POST", P("hardware/route.ts"), "POST", "library"],
  ["Hardware PATCH", P("hardware/[id]/route.ts"), "PATCH", "library"],
  ["Hardware DELETE", P("hardware/[id]/route.ts"), "DELETE", "library"],
  ["Machine profile POST", P("machine-profiles/route.ts"), "POST", "library"],
  ["Machine profile PATCH", P("machine-profiles/[id]/route.ts"), "PATCH", "library"],
  ["Machine profile DELETE", P("machine-profiles/[id]/route.ts"), "DELETE", "library"],
  // Scene assets
  ["Scene definition POST", P("scene-asset-definitions/route.ts"), "POST", "library"],
  ["Scene definition PATCH", P("scene-asset-definitions/[id]/route.ts"), "PATCH", "library"],
  ["Scene definition DELETE", P("scene-asset-definitions/[id]/route.ts"), "DELETE", "library"],
  ["Scene definition revise POST", P("scene-asset-definitions/[id]/revise/route.ts"), "POST", "library"],
  ["Scene instance POST", P("projects/[id]/rooms/[roomId]/scene-assets/route.ts"), "POST", "design"],
  ["Scene instance PATCH", P("projects/[id]/rooms/[roomId]/scene-assets/[instanceId]/route.ts"), "PATCH", "design"],
  ["Scene instance DELETE", P("projects/[id]/rooms/[roomId]/scene-assets/[instanceId]/route.ts"), "DELETE", "design"],
  // Project sub-resources
  ["Quote POST", P("projects/[id]/quotes/route.ts"), "POST", "design"],
  ["Quote PATCH", P("projects/[id]/quotes/[quoteId]/route.ts"), "PATCH", "design"],
  ["Quote DELETE", P("projects/[id]/quotes/[quoteId]/route.ts"), "DELETE", "design"],
  ["Installer feedback POST", P("projects/[id]/installer-feedback/route.ts"), "POST", "design"],
  ["Installer feedback PATCH", P("projects/[id]/installer-feedback/[feedbackId]/route.ts"), "PATCH", "design"],
  ["Installer feedback DELETE", P("projects/[id]/installer-feedback/[feedbackId]/route.ts"), "DELETE", "design"],
  ["Sketch-to-CAD POST", P("projects/[id]/sketch-to-cad/route.ts"), "POST", "design"],
  ["Cabinet validate POST", P("projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/validate/route.ts"), "POST", "design"],
  ["CNC export POST", P("projects/[id]/cnc-export/route.ts"), "POST", "design"],
  ["AI Copilot POST", P("projects/[id]/ai-copilot/route.ts"), "POST", "design"],
  // Production runs — viewer stays read-only (no shop-floor redefinition)
  ["Production run POST", P("projects/[id]/production-runs/route.ts"), "POST", "design"],
  ["Production run PATCH", P("projects/[id]/production-runs/[runId]/route.ts"), "PATCH", "design"],
  ["Production run DELETE", P("projects/[id]/production-runs/[runId]/route.ts"), "DELETE", "design"],
  // Clients create/edit (prerequisite for designer project creation);
  // DELETE is owner/admin — asserted separately below.
  ["Client POST", P("clients/route.ts"), "POST", "design"],
  ["Client PATCH", P("clients/[id]/route.ts"), "PATCH", "design"],
];

describe.each(HARDENED)("%s — role-guarded before any I/O", (_label, path, method, tier) => {
  const body = handlerBody(path, method);
  const { fn, message } = PREDICATE[tier];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  it(`guards with ${fn} → 403 FORBIDDEN`, () => {
    expect(body).toMatch(
      new RegExp(
        `if \\(!${esc(fn)}\\((?:ctx\\.)?role\\)\\) \\{\\s*return apiError\\(${esc(message)}, 403, FORBIDDEN_CODE\\);`,
      ),
    );
  });

  it("the guard precedes the first await (no DB / body / upstream access first)", () => {
    const guard = body.indexOf(`${fn}(`);
    const firstAwait = body.search(/\bawait\b/);
    expect(guard).toBeGreaterThan(0);
    expect(firstAwait).toBeGreaterThan(guard);
  });

  if (tier === "library") {
    it("does NOT use the designer-inclusive predicate", () => {
      expect(body).not.toContain("canMutateDesignContent");
      expect(body).not.toContain("canAssignCabinetSystems");
    });
  }
});

// ─── Explicit domain matrices ─────────────────────────────────────────

describe("explicit domain role matrices", () => {
  const cases: Array<[domain: string, fn: (r: string) => boolean, allowed: string[]]> = [
    ["Phase 1 profiles — owner/admin manage", canManageOrganizationLibrary, ["owner", "admin"]],
    ["Cabinet parts — owner/admin/designer mutate", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Project create/edit — designer allowed", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Project delete — owner/admin only (3.1a)", canManageOrganizationStandards, ["owner", "admin"]],
    ["Room — designer mutate", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Org libraries — owner/admin manage", canManageOrganizationLibrary, ["owner", "admin"]],
    ["Scene instance — designer place/edit/remove", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Scene definition — designer cannot manage", canManageOrganizationLibrary, ["owner", "admin"]],
    ["Revision — designer allowed (3.1a)", canAssignCabinetSystems, ["owner", "admin", "designer"]],
    ["Production runs — owner/admin/designer mutate", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["AI Copilot — owner/admin/designer execute", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Client create/edit — owner/admin/designer", canMutateDesignContent, ["owner", "admin", "designer"]],
    ["Client delete — owner/admin only", canManageOrganizationStandards, ["owner", "admin"]],
  ];
  describe.each(cases)("%s", (_d, fn, allowed) => {
    it.each(["owner", "admin", "designer", "viewer"])("%s", (role) => {
      expect(fn(role)).toBe(allowed.includes(role));
    });
  });
});

// ─── Unchanged semantics / internal callers ───────────────────────────

describe("unchanged beyond authorization", () => {
  it("Project DELETE keeps the 3.1a owner/admin guard", () => {
    const body = handlerBody(P("projects/[id]/route.ts"), "DELETE");
    expect(body).toMatch(/if \(!canManageOrganizationStandards\(role\)\)/);
    expect(body).not.toContain("canMutateDesignContent");
  });

  it("Room DELETE keeps the 3.1a cabinet-mutation guard", () => {
    const body = handlerBody(P("projects/[id]/rooms/[roomId]/route.ts"), "DELETE");
    expect(body).toMatch(/if \(!canAssignCabinetSystems\(role\)\)/);
  });

  it("Cabinet part DELETE still refuses CAD-computed parts", () => {
    const body = handlerBody(P("projects/[id]/rooms/[roomId]/cabinets/[cabinetId]/parts/[partId]/route.ts"), "DELETE");
    expect(body).toMatch(/if \(!existing\.isManual\) return apiError\(/);
  });

  it("Scene definition writes still apply scope / platform-admin rules", () => {
    const patch = handlerBody(P("scene-asset-definitions/[id]/route.ts"), "PATCH");
    expect(patch).toMatch(/if \(!canWriteSceneAssetDefinition\(record, requester\)\) return apiError\("Forbidden", 403\)/);
    const post = handlerBody(P("scene-asset-definitions/route.ts"), "POST");
    expect(post).toMatch(/if \(scope === "system" && !admin\)/);
  });

  it("internal CAD part regeneration (lib/parts.ts) is not role-gated", () => {
    const src = readFileSync(resolve(API, "../../lib/parts.ts"), "utf8");
    expect(src).not.toMatch(/\brole\b/);
    expect(src).not.toMatch(/canMutateDesignContent|canAssignCabinetSystems|canManageOrganization/);
  });
});

// ─── Final policy decisions ───────────────────────────────────────────

describe("Quote status transitions — accepted/rejected are owner/admin", () => {
  it("decision statuses are the existing enum values", () => {
    expect([...QUOTE_DECISION_STATUSES].sort()).toEqual(["accepted", "rejected"]);
    expect(FORBIDDEN_MESSAGE_QUOTE_DECISION.length).toBeGreaterThan(0);
  });

  it.each([
    // [role, from, to, allowed]
    ["designer", "draft", undefined, true],   // normal edit (no status change)
    ["designer", "draft", "sent", true],      // send
    ["designer", "sent", "draft", true],
    ["designer", "sent", "expired", true],
    ["designer", "draft", "accepted", false],
    ["designer", "sent", "rejected", false],
    ["designer", "accepted", "accepted", true], // not a transition
    ["owner", "sent", "accepted", true],
    ["admin", "sent", "rejected", true],
    ["owner", "draft", "sent", true],
    ["viewer", "draft", undefined, false],
    ["viewer", "draft", "sent", false],
    ["viewer", "sent", "accepted", false],
    [undefined, "sent", "accepted", false],
  ] as const)("%s: %s → %s ⇒ %s", (role, from, to, allowed) => {
    expect(canTransitionQuoteStatus(role, from, to)).toBe(allowed);
  });

  it("PATCH checks the transition after the org-scoped lookup and before the write", () => {
    const body = handlerBody(P("projects/[id]/quotes/[quoteId]/route.ts"), "PATCH");
    const lookup = body.indexOf('if (!existing) return apiError("Quote not found", 404)');
    const check = body.search(
      /if \(!canTransitionQuoteStatus\(role, existing\.status, parsed\.data\.status\)\) \{\s*return apiError\(FORBIDDEN_MESSAGE_QUOTE_DECISION, 403, FORBIDDEN_CODE\);/,
    );
    const write = body.indexOf("prisma.quote.update(");
    expect(lookup).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(lookup);
    expect(write).toBeGreaterThan(check);
  });

  it("quote totals computation is unchanged", () => {
    const body = handlerBody(P("projects/[id]/quotes/[quoteId]/route.ts"), "PATCH");
    expect(body).toMatch(/const \{ subtotal, taxAmount, total \} = computeTotals\(lineItems, taxRate\);/);
  });
});

describe.each([
  ["AI Copilot", P("projects/[id]/ai-copilot/route.ts"), /\bgetOpenAI\(\)|req\.json\(\)/],
  ["Sketch-to-CAD", P("projects/[id]/sketch-to-cad/route.ts"), /\banalyzeSketch\(|req\.formData\(\)/],
])("%s — org-scoped project check before paid upstream call", (_label, path, upstream) => {
  const body = handlerBody(path, "POST");

  it("role guard retained", () => {
    expect(body).toMatch(
      /if \(!canMutateDesignContent\(role\)\) \{\s*return apiError\(FORBIDDEN_MESSAGE_ASSIGN, 403, FORBIDDEN_CODE\);/,
    );
  });

  it("looks the project up scoped by orgId and 404s when absent", () => {
    expect(body).toMatch(
      /prisma\.project\.findFirst\(\{\s*where: \{ id: params\.id, orgId \},\s*select: \{ id: true \},\s*\}\);\s*if \(!project\) return apiError\("Project not found", 404\);/,
    );
  });

  it("order: role guard → project lookup → body / upstream AI", () => {
    const guard = body.indexOf("canMutateDesignContent(role)");
    const lookup = body.indexOf("prisma.project.findFirst(");
    const firstUpstream = body.search(upstream);
    expect(guard).toBeGreaterThan(0);
    expect(lookup).toBeGreaterThan(guard);
    expect(firstUpstream).toBeGreaterThan(lookup);
  });
});

describe("Client DELETE — owner/admin only", () => {
  const body = handlerBody(P("clients/[id]/route.ts"), "DELETE");

  it("guards with the owner/admin predicate before any I/O", () => {
    expect(body).toMatch(
      /if \(!canManageOrganizationStandards\(role\)\) \{\s*return apiError\("Only owners and admins can delete clients\.", 403, FORBIDDEN_CODE\);/,
    );
    expect(body).not.toContain("canMutateDesignContent");
    expect(body.search(/\bawait\b/)).toBeGreaterThan(body.indexOf("canManageOrganizationStandards(role)"));
  });

  it("keeps the has-projects 409 relationship rule", () => {
    expect(body).toMatch(/if \(projectCount > 0\) \{\s*return apiError\(/);
  });
});

// ─── UI alignment (web has no test runner — source wiring) ────────────

const WEB = resolve(HERE, "../../../../../../apps/web/src");

describe.each([
  ["Materials", "app/(dashboard)/materials/page.tsx", ["+ Add Material"]],
  ["Hardware", "app/(dashboard)/settings/hardware/page.tsx", ["+ Add Hardware"]],
  ["Machine Profiles", "app/(dashboard)/settings/machines/page.tsx", ["+ Add Machine"]],
  ["Asset Library", "app/(dashboard)/assets/page.tsx", ["+ Add Asset", "Upload your first asset"]],
])("%s UI — management controls mirror owner/admin policy", (_label, rel, addLabels) => {
  const src = readFileSync(resolve(WEB, rel), "utf8").replace(/\r\n/g, "\n");

  it("derives canManage from the shared library predicate", () => {
    expect(src).toMatch(/import \{ canManageOrganizationLibrary \} from "@\/lib\/authz";/);
    expect(src).toMatch(/const canManage = canManageOrganizationLibrary\(role\);/);
  });

  it.each(addLabels)("'%s' control renders only when canManage", (label) => {
    const at = src.indexOf(label);
    expect(at).toBeGreaterThan(0);
    const gate = src.lastIndexOf("{canManage && (", at);
    expect(gate).toBeGreaterThan(0);
    // No closing of the gate between it and the control.
    expect(src.slice(gate, at)).not.toMatch(/\n\s*\)\}\n/);
  });

  it("editor / upload modal is unreachable without canManage", () => {
    expect(src).toMatch(/\{canManage && (modal !== null|showAdd) && \(/);
  });

  it("shows a read-only notice for designer/viewer", () => {
    expect(src).toMatch(/\{!canManage && \(\s*<p[^>]*>\s*Read-only · only owners and admins/);
  });

  it("row Edit/Delete/Archive actions are gated", () => {
    if (rel.includes("assets")) {
      expect(src).toMatch(/onArchive=\{canManage \? \(\) => void handleArchive\(r\) : undefined\}/);
      expect(src).toMatch(/\{record\.active && onArchive && \(/);
    } else {
      expect(src).toMatch(/\{canManage && \(\s*<div className="flex gap-3">\s*<button onClick=\{\(\) => openEdit\(/);
    }
  });
});
