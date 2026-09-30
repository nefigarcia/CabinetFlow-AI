// Application funnel analytics (Meta Pixel).
//
// MetaPixel.tsx owns the pixel bootstrap + SPA PageView; this module owns
// application events. Every helper is fire-and-forget: it no-ops on the
// server or when the pixel is absent/blocked, and never throws.
//
// PRIVACY: never pass PII or user-entered content (email, names, company,
// client or project names, ids). Event names only, plus non-identifying
// params when genuinely useful.

export type MetaStandardEvent = "CompleteRegistration";

export type CabinetFlowEvent =
  | "CabinetFlow_OnboardingViewed"
  | "CabinetFlow_OnboardingSkipped"
  | "CabinetFlow_QuickStartStarted"
  | "CabinetFlow_FirstProjectCreated"
  | "CabinetFlow_EditorOpened"
  | "CabinetFlow_AIStarterUsed"
  | "CabinetFlow_FirstCabinetCreated"
  | "CabinetFlow_Activated";

type EventParams = Record<string, string | number | boolean>;

function send(kind: "track" | "trackCustom", event: string, params?: EventParams): void {
  try {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    if (params) window.fbq(kind, event, params);
    else window.fbq(kind, event);
  } catch {
    // Analytics must never affect the product.
  }
}

export function trackMetaEvent(event: MetaStandardEvent, params?: EventParams): void {
  send("track", event, params);
}

export function trackMetaCustomEvent(event: CabinetFlowEvent, params?: EventParams): void {
  send("trackCustom", event, params);
}

// ─── Deduplication ────────────────────────────────────────────────────
//
// `sessionKeys` guards React re-renders / StrictMode double effects for
// the life of the page. `persist` additionally remembers the key in
// localStorage so once-per-user funnel milestones don't repeat on reload.
// This is analytics bookkeeping only — never activation status.

const sessionKeys = new Set<string>();
const STORAGE_PREFIX = "cabinetflow:analytics:";

function persisted(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function persist(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, "1");
  } catch {
    // Storage blocked — session dedupe still applies.
  }
}

export function trackMetaCustomEventOnce(
  event: CabinetFlowEvent,
  dedupeKey: string = event,
  options: { persist?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  if (sessionKeys.has(dedupeKey)) return;
  if (options.persist && persisted(dedupeKey)) return;
  sessionKeys.add(dedupeKey);
  if (options.persist) persist(dedupeKey);
  trackMetaCustomEvent(event);
}

/** The activation milestone: first successfully PERSISTED cabinet. Fires
 *  FirstCabinetCreated + Activated at most once per browser. */
export function trackFirstCabinetActivation(): void {
  trackMetaCustomEventOnce("CabinetFlow_FirstCabinetCreated", "first-cabinet", { persist: true });
  trackMetaCustomEventOnce("CabinetFlow_Activated", "activated", { persist: true });
}
