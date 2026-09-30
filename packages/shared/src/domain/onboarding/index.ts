// Public API for first-run onboarding / activation (derived — no stored flags).

export {
  deriveOnboardingStatus,
  loadOnboardingStatus,
  type OnboardingCounts,
  type OnboardingStatus,
  type OnboardingStatusDb,
} from "./status";

export {
  DEFAULT_ROOM_DIMENSIONS_MM,
  QUICK_START_DEFAULT_ROOM_NAME,
  quickStartSchema,
  resolveQuickStartRoomName,
  runQuickStart,
  type QuickStartData,
  type QuickStartDb,
  type QuickStartResult,
  type QuickStartTx,
} from "./quick-start";
