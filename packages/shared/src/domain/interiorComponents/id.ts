// Stable browser + Node interior-component ID generator.
//
// Reuses `crypto.randomUUID` — already available in modern browsers and
// Node 18+, and already used by apps/web/src/components/editor/
// AICopilotPanel.tsx for chat message IDs. Same source of truth so
// Phase 3 doesn't drag Prisma cuid machinery into web / shared code.
//
// The DOM `crypto` global is available in every environment WoodCraft
// runs in (Next.js middleware/edge, Next.js browser, Next.js Node
// server, vitest jsdom). The narrow `unknown` cast defends against
// jsdom setups where the global isn't typed on `globalThis`.

export function newInteriorComponentId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  // Extremely defensive fallback — should never run in any supported
  // environment. Do NOT rely on it for uniqueness at scale; it exists
  // so a broken test harness doesn't hard-crash.
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${rand()}-${rand()}-${rand()}-${rand()}`;
}

/** Validates a stored ID at the boundary. Rejects empty / whitespace /
 *  non-string. Does NOT enforce a specific UUID shape — legacy
 *  serialized rows that carried a shorter ID must not be lost. */
export function isValidInteriorComponentId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0;
}
