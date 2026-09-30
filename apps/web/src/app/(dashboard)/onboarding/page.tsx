"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUICK_START_DEFAULT_ROOM_NAME, type QuickStartResult } from "@woodcraft/shared";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { canMutateDesignContent } from "@/lib/authz";
import { trackMetaCustomEvent, trackMetaCustomEventOnce } from "@/lib/analytics";
import { continueDesigningHref, useActivationStatus } from "@/hooks/useActivationStatus";

// First-run Quick Start: Client + Project + Room in one step, then straight
// into the visual editor. Status is server-derived; established users
// (who already have a cabinet) are never pushed back through this page.

const GOLD = "#E8C547";

const inputCls =
  "w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8C547]/60";

export default function OnboardingPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canDesign = canMutateDesignContent(role);
  const { status, loading } = useActivationStatus();

  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [roomName, setRoomName] = useState(QUICK_START_DEFAULT_ROOM_NAME);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startNew, setStartNew] = useState(false);

  const activated = status?.activated === true;
  const continueHref = status && status.steps.project ? continueDesigningHref(status) : null;
  const showForm = !loading && canDesign && !activated && (!continueHref || startNew);

  useEffect(() => {
    if (showForm) trackMetaCustomEventOnce("CabinetFlow_OnboardingViewed", "onboarding-viewed");
  }, [showForm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!clientName.trim()) { setError("Add who this job is for."); return; }
    if (!projectName.trim()) { setError("Give the project a name."); return; }

    setSubmitting(true);
    setError(null);
    trackMetaCustomEvent("CabinetFlow_QuickStartStarted");
    try {
      const res = await apiClient.post<QuickStartResult>("/onboarding/quick-start", {
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        roomName: roomName.trim() || undefined,
      });
      if (!status?.steps.project) trackMetaCustomEvent("CabinetFlow_FirstProjectCreated");
      router.push(`/projects/${res.project.id}/editor?onboarding=1`);
      // Keep the button in its busy state while the editor route loads.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg
          ? `We couldn't create your project: ${msg}. Your details are still here — try again.`
          : "We couldn't create your project. Your details are still here — try again.",
      );
      setSubmitting(false);
    }
  }

  function skip() {
    trackMetaCustomEvent("CabinetFlow_OnboardingSkipped");
    router.push("/dashboard");
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 flex justify-center">
      <div className="w-full max-w-xl enter-fade-up">
        {/* Progress */}
        <ol className="flex items-center gap-2 sm:gap-3 mb-8 text-xs" aria-label="Setup progress">
          {[
            { label: "Account", done: true },
            { label: "Project", done: Boolean(status?.steps.project) },
            { label: "First cabinet", done: activated },
          ].map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && <span aria-hidden className="w-6 sm:w-10 h-px" style={{ background: "#2E3240" }} />}
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                  style={
                    s.done
                      ? { background: GOLD, color: "#111214" }
                      : { border: "1px solid #3A4250", color: "#6b7280" }
                  }
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={s.done ? "text-gray-300" : "text-gray-500"}>
                  {s.label}
                  <span className="sr-only">{s.done ? " — done" : ""}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>

        {loading ? (
          <div aria-busy="true" aria-label="Loading" className="space-y-3">
            {[56, 20, 160].map((h, i) => (
              <div
                key={i}
                className="rounded-lg"
                style={{
                  height: h,
                  background: "linear-gradient(90deg, #1A1E24 30%, #222629 50%, #1A1E24 70%)",
                  backgroundSize: "300% 100%",
                  animation: "card-shimmer 1.5s linear infinite",
                }}
              />
            ))}
          </div>
        ) : activated ? (
          <Panel>
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re ready to design.</h1>
            <p className="text-gray-400 text-sm mb-6">
              Your workspace already has cabinet designs. Pick up from your dashboard.
            </p>
            <PrimaryLink href="/dashboard">Go to Dashboard</PrimaryLink>
          </Panel>
        ) : !canDesign ? (
          <Panel>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to CabinetFlow</h1>
            <p className="text-gray-400 text-sm mb-6">
              Your account has view access. An owner, admin, or designer on your team can create
              projects — you&apos;ll see them on your dashboard.
            </p>
            <PrimaryLink href="/dashboard">Go to Dashboard</PrimaryLink>
          </Panel>
        ) : continueHref && !startNew ? (
          <Panel>
            <h1 className="text-2xl font-bold text-white mb-2">Continue your first design</h1>
            <p className="text-gray-400 text-sm mb-6">
              {status?.firstProject
                ? `${status.firstProject.name} is ready — open the editor and add your first cabinet.`
                : "Your project is ready — open the editor and add your first cabinet."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <PrimaryLink href={continueHref}>Continue designing →</PrimaryLink>
              <button
                type="button"
                onClick={() => setStartNew(true)}
                className="text-sm text-gray-400 hover:text-white underline underline-offset-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547]"
              >
                Start a different project
              </button>
            </div>
          </Panel>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Design your first project</h1>
            <p className="text-gray-400 text-sm mb-8">
              Create a job and jump directly into CabinetFlow&apos;s visual editor.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <Panel>
                <div className="space-y-5">
                  <Field label="Client / job for" htmlFor="qs-client" hint="Who is this work for?">
                    <input
                      id="qs-client"
                      autoFocus
                      autoComplete="off"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Johnson Residence"
                      maxLength={255}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Project" htmlFor="qs-project">
                    <input
                      id="qs-project"
                      autoComplete="off"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Kitchen Remodel"
                      maxLength={255}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Room" htmlFor="qs-room" hint="You can add more rooms later.">
                    <input
                      id="qs-room"
                      autoComplete="off"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder={QUICK_START_DEFAULT_ROOM_NAME}
                      maxLength={255}
                      className={inputCls}
                    />
                  </Field>
                </div>

                {error && (
                  <p role="alert" className="text-red-400 text-sm mt-5">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full text-sm font-semibold rounded-lg py-3 transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]"
                  style={{ background: GOLD, color: "#111214" }}
                >
                  {submitting ? "Creating your workspace…" : "Create project & open editor"}
                </button>
              </Panel>
            </form>

            <div className="mt-5 text-center">
              {startNew && continueHref ? (
                <button
                  type="button"
                  onClick={() => setStartNew(false)}
                  className="text-sm text-gray-500 hover:text-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547]"
                >
                  ← Back to my first project
                </button>
              ) : (
                <button
                  type="button"
                  onClick={skip}
                  className="text-sm text-gray-500 hover:text-gray-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547]"
                >
                  I&apos;ll explore on my own
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 sm:p-6" style={{ background: "#111214", border: "1px solid #1E2226" }}>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[10px] uppercase text-gray-400 mb-1.5" style={{ letterSpacing: "2px" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block text-center text-sm font-semibold rounded-lg px-5 py-2.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]"
      style={{ background: GOLD, color: "#111214" }}
    >
      {children}
    </Link>
  );
}
