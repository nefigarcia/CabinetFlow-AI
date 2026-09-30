"use client";

import Link from "next/link";
import type { OnboardingStatus } from "@woodcraft/shared";
import { continueDesigningHref } from "@/hooks/useActivationStatus";

// Compact first-design milestone card. Pure presentation: status comes in
// via props (the caller owns the single /onboarding/status fetch).
// Renders nothing once the org is activated (has a cabinet).

const GOLD = "#E8C547";

interface Props {
  status: OnboardingStatus;
  className?: string;
}

export function ActivationChecklist({ status, className }: Props) {
  if (status.activated) return null;

  const hasProject = status.steps.project;
  const continueHref = continueDesigningHref(status);
  const cta = hasProject && continueHref
    ? { href: continueHref, label: "Continue designing →" }
    : { href: "/onboarding", label: "Start first project →" };

  const milestones = [
    { label: "Account created", done: true },
    { label: "Project created", done: hasProject },
    { label: "First cabinet added", done: status.steps.cabinet },
  ];

  return (
    <section
      aria-label="Your first design"
      className={["rounded-xl p-4 sm:p-5 enter-fade-up", className ?? ""].join(" ")}
      style={{
        background: "linear-gradient(135deg, rgba(232,197,71,0.08), rgba(17,18,20,0.9) 55%)",
        border: "1px solid rgba(232,197,71,0.35)",
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase mb-1" style={{ letterSpacing: "2px", color: GOLD }}>
            Your first design
          </p>
          <h2 className="text-white font-semibold text-lg">
            {hasProject ? "Continue your first design" : "Create your first cabinet design"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {hasProject && status.firstProject
              ? `Pick up where you left off in ${status.firstProject.name} and add your first cabinet.`
              : "Start with a client and project, then build your first room in the visual editor."}
          </p>
        </div>

        <ol className="flex flex-col sm:flex-row md:flex-col gap-1.5 sm:gap-4 md:gap-1.5 flex-shrink-0">
          {milestones.map((m) => (
            <li key={m.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                style={
                  m.done
                    ? { background: GOLD, color: "#111214" }
                    : { border: "1px solid #3A4250", color: "transparent" }
                }
              >
                ✓
              </span>
              <span className={m.done ? "text-gray-300" : "text-gray-500"}>
                {m.label}
                <span className="sr-only">{m.done ? " — done" : " — to do"}</span>
              </span>
            </li>
          ))}
        </ol>

        <Link
          href={cta.href}
          className="flex-shrink-0 text-center text-sm font-semibold rounded-lg px-4 py-2.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C547] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111214]"
          style={{ background: GOLD, color: "#111214" }}
        >
          {cta.label}
        </Link>
      </div>
    </section>
  );
}
