"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import type { OnboardingStatus } from "@woodcraft/shared";

export type { OnboardingStatus };

// Server-derived activation status (GET /onboarding/status). Fetches once
// on mount; call `refresh()` when a caller knows it changed. No polling.
// On failure `status` stays null and `error` is set — callers render
// normally without the activation UI.

export function useActivationStatus() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiClient.get<OnboardingStatus>("/onboarding/status");
      if (mounted.current) setStatus(next);
    } catch (e: unknown) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { status, loading, error, refresh };
}

/** Where "continue" should take a user who has a project but no cabinet. */
export function continueDesigningHref(status: OnboardingStatus): string | null {
  return status.firstProject ? `/projects/${status.firstProject.id}/editor?onboarding=1` : null;
}
