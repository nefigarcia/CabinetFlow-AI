import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ═══════════════════════════════════════════════════════════════════════
// Web onboarding layer. apps/web has no test runner, so (as with the
// authorization UI tests) this lives in the shared Vitest suite:
//   · analytics.ts is dependency-free → exercised BEHAVIOURALLY against a
//     fake window (SSR no-op, never throws, dedupe, no params/PII).
//   · components/hooks are asserted on source wiring.
// ═══════════════════════════════════════════════════════════════════════

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../../../../../../apps/web/src");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf8").replace(/\r\n/g, "\n");

// Loaded via a non-literal specifier so the shared (non-DOM) tsc program
// never type-checks web code; the surface used here is declared locally.
interface Analytics {
  trackMetaEvent(event: "CompleteRegistration"): void;
  trackMetaCustomEvent(event: string): void;
  trackMetaCustomEventOnce(event: string, dedupeKey?: string, options?: { persist?: boolean }): void;
  trackFirstCabinetActivation(): void;
}
const ANALYTICS_MODULE = resolve(WEB, "lib/analytics.ts");

async function freshAnalytics(): Promise<Analytics> {
  vi.resetModules(); // new module instance → empty session dedupe set
  return (await import(/* @vite-ignore */ ANALYTICS_MODULE)) as Analytics;
}

function installWindow(opts: { fbq?: (...a: unknown[]) => void; storage?: Map<string, string> | "throws" } = {}) {
  const store = opts.storage === "throws" ? null : (opts.storage ?? new Map<string, string>());
  const localStorage = {
    getItem: (k: string) => {
      if (!store) throw new Error("blocked");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (!store) throw new Error("blocked");
      store.set(k, v);
    },
  };
  (globalThis as { window?: unknown }).window = { fbq: opts.fbq, localStorage };
  return store;
}

describe("lib/analytics — safe Meta Pixel helpers", () => {
  beforeEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("no-ops on the server (no window)", async () => {
    const a = await freshAnalytics();
    expect(() => a.trackMetaEvent("CompleteRegistration")).not.toThrow();
    expect(() => a.trackFirstCabinetActivation()).not.toThrow();
  });

  it("no-ops when the pixel is absent", async () => {
    installWindow({ fbq: undefined });
    const a = await freshAnalytics();
    expect(() => a.trackMetaCustomEvent("CabinetFlow_EditorOpened")).not.toThrow();
  });

  it("never throws even if fbq throws", async () => {
    installWindow({ fbq: () => { throw new Error("pixel blew up"); } });
    const a = await freshAnalytics();
    expect(() => a.trackMetaCustomEvent("CabinetFlow_Activated")).not.toThrow();
  });

  it("standard vs custom event routing, with no params (no PII)", async () => {
    const fbq = vi.fn();
    installWindow({ fbq });
    const a = await freshAnalytics();
    a.trackMetaEvent("CompleteRegistration");
    a.trackMetaCustomEvent("CabinetFlow_QuickStartStarted");
    expect(fbq.mock.calls).toEqual([
      ["track", "CompleteRegistration"],
      ["trackCustom", "CabinetFlow_QuickStartStarted"],
    ]);
  });

  it("trackMetaCustomEventOnce dedupes within the page session", async () => {
    const fbq = vi.fn();
    installWindow({ fbq });
    const a = await freshAnalytics();
    a.trackMetaCustomEventOnce("CabinetFlow_EditorOpened", "editor-opened:p1");
    a.trackMetaCustomEventOnce("CabinetFlow_EditorOpened", "editor-opened:p1");
    a.trackMetaCustomEventOnce("CabinetFlow_EditorOpened", "editor-opened:p2");
    expect(fbq).toHaveBeenCalledTimes(2);
    // The dedupe key (which may hold an id) is never sent.
    for (const call of fbq.mock.calls) expect(call).toEqual(["trackCustom", "CabinetFlow_EditorOpened"]);
  });

  it("first-cabinet activation fires FirstCabinetCreated + Activated once, persisting across reloads", async () => {
    const storage = new Map<string, string>();
    const fbq = vi.fn();
    installWindow({ fbq, storage });
    let a = await freshAnalytics();
    a.trackFirstCabinetActivation();
    a.trackFirstCabinetActivation(); // second AI-batch cabinet / rerender
    expect(fbq.mock.calls).toEqual([
      ["trackCustom", "CabinetFlow_FirstCabinetCreated"],
      ["trackCustom", "CabinetFlow_Activated"],
    ]);

    // "Reload": fresh module, same localStorage → no refire.
    a = await freshAnalytics();
    a.trackFirstCabinetActivation();
    expect(fbq).toHaveBeenCalledTimes(2);
  });

  it("blocked localStorage degrades to session dedupe", async () => {
    const fbq = vi.fn();
    installWindow({ fbq, storage: "throws" });
    const a = await freshAnalytics();
    a.trackFirstCabinetActivation();
    a.trackFirstCabinetActivation();
    expect(fbq).toHaveBeenCalledTimes(2);
  });
});

describe("registration → onboarding", () => {
  const src = read("app/(auth)/register/page.tsx");

  it("keeps CompleteRegistration (via the helper) after a successful /auth/register", () => {
    const post = src.indexOf('apiClient.post<AuthResponse>("/auth/register", form)');
    const track = src.indexOf('trackMetaEvent("CompleteRegistration")');
    expect(post).toBeGreaterThan(0);
    expect(track).toBeGreaterThan(post);
    expect(src).not.toMatch(/window\.fbq/);
  });

  it("routes new accounts to /onboarding after setAuth", () => {
    expect(src.indexOf('router.push("/onboarding")')).toBeGreaterThan(src.indexOf("setAuth(res.user"));
    expect(src).not.toMatch(/router\.push\("\/dashboard"\)/);
  });
});

describe("useCabinets — activation on first PERSISTED cabinet", () => {
  const src = read("hooks/useCabinets.ts");
  const create = src.slice(src.indexOf("const create = useCallback"), src.indexOf("const save = useCallback"));

  it("reads emptiness from live store state before the API call", () => {
    const empty = create.indexOf("useEditorStore.getState().cabinets.length === 0");
    expect(empty).toBeGreaterThan(0);
    expect(empty).toBeLessThan(create.indexOf("apiClient.post"));
  });

  it("fires only after the server create + store add succeed (not in catch)", () => {
    const fire = create.indexOf("if (wasEmpty) trackFirstCabinetActivation()");
    expect(fire).toBeGreaterThan(create.indexOf("addCabinet(cabinet)"));
    expect(fire).toBeLessThan(create.indexOf("catch"));
  });

  it("create payload is unchanged", () => {
    expect(create).toMatch(/apiClient\.post<CabinetResponse>\(baseUrl\(\), data\)/);
  });
});

describe("EditorFirstRunGuide + RoomsWorkspace integration", () => {
  const guide = read("components/onboarding/EditorFirstRunGuide.tsx");
  const ws = read("components/workspace/RoomsWorkspace.tsx");

  it("shows only for ?onboarding=1, a loaded room, zero cabinets, not dismissed", () => {
    expect(guide).toMatch(/get\("onboarding"\) === "1"/);
    expect(guide).toMatch(/if \(!onboardingMode \|\| !roomReady \|\| cabinetCount > 0 \|\| dismissed\) return null;/);
    expect(guide).toMatch(/"cabinetflow:onboarding:editor-guide-dismissed"/);
  });

  it("owns no editor/domain state and never creates cabinets", () => {
    expect(guide).not.toMatch(/useEditorStore|apiClient|useCabinets|create\(/);
  });

  it("drives the EXISTING AI Copilot state (no second panel)", () => {
    expect(ws).toMatch(/onDesignWithAI=\{\(\) => setAiCopilotOpen\(true\)\}/);
    expect(ws.match(/<AICopilotPanel/g)).toHaveLength(1);
  });

  it("tracks EditorOpened once, without sending the project id", () => {
    expect(ws).toMatch(/trackMetaCustomEventOnce\("CabinetFlow_EditorOpened", `editor-opened:\$\{projectId\}`\)/);
    const editorPage = read("app/(dashboard)/projects/[id]/editor/page.tsx");
    expect(editorPage).not.toMatch(/EditorOpened/);
  });
});

describe("AI Copilot starter prompts", () => {
  const src = read("components/editor/AICopilotPanel.tsx");
  const apply = src.slice(src.indexOf("const applyStarterPrompt"), src.indexOf("const retryAdd"));

  it("populate the textarea only — never auto-send", () => {
    expect(apply).toMatch(/setInput\(prompt\)/);
    expect(apply).not.toMatch(/send\(|onAddCabinets|apiClient/);
  });

  it("offers the three starter prompts in the empty state", () => {
    for (const label of ["Modern kitchen with an island", "Simple wall of base + upper cabinets", "Laundry room storage"]) {
      expect(src).toContain(label);
    }
  });
});

describe("onboarding page + entry points", () => {
  const page = read("app/(dashboard)/onboarding/page.tsx");

  it("Quick Start posts once and goes straight to the editor in onboarding mode", () => {
    expect(page).toMatch(/apiClient\.post<QuickStartResult>\("\/onboarding\/quick-start"/);
    expect(page).toMatch(/router\.push\(`\/projects\/\$\{res\.project\.id\}\/editor\?onboarding=1`\)/);
    expect(page).toMatch(/if \(submitting\) return;/);
    expect(page).toContain("Creating your workspace…");
  });

  it("activation UI is driven by server status, not localStorage", () => {
    expect(page).toMatch(/useActivationStatus\(\)/);
    expect(page).not.toMatch(/localStorage/);
    const dash = read("app/(dashboard)/dashboard/page.tsx");
    expect(dash).toMatch(/activation && !activation\.activated && canDesign &&/);
  });

  it("NewProjectModal no longer dead-ends without clients", () => {
    const modal = read("components/projects/NewProjectModal.tsx");
    expect(modal).not.toMatch(/Add one first/);
    expect(modal).toMatch(/apiClient\.post<Client>\("\/clients"/);
    expect(modal).not.toMatch(/\.catch\(\(\) => \{\}\)/); // no silently swallowed room failure
  });
});
