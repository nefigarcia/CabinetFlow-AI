// Public API for the Phase 3.0 interior-components domain.

export type {
  CabinetInteriorComponent,
  CustomInteriorComponent,
  DrawerDividerComponent,
  HiddenDrawerComponent,
  InteriorCabinetContext,
  InteriorComponentTarget,
  InteriorComponentType,
  InteriorComponentVerificationStatus,
  InteriorReadinessCode,
  InteriorReadinessIssue,
  InteriorTargetKind,
  KnifeOrganizerComponent,
  RolloutComponent,
  SinkPulloutComponent,
  SpiceRackComponent,
  SpongeTiltOutComponent,
  TrashPulloutComponent,
  TrayDividerComponent,
  UtensilDividerComponent,
} from "./types";
export {
  INTERIOR_COMPONENT_TYPES,
  INTERIOR_COMPONENT_VERIFICATION_STATUSES,
  INTERIOR_READINESS_CODES,
  INTERIOR_TARGET_KINDS,
} from "./types";

export {
  cabinetInteriorComponentSchema,
  cabinetInteriorComponentsArraySchema,
  interiorComponentTargetSchema,
  type CabinetInteriorComponentsArray,
} from "./schemas";

export {
  isValidInteriorComponentId,
  newInteriorComponentId,
} from "./id";

export { evaluateInteriorComponentsReadiness } from "./compatibility";

export {
  INTERIOR_COMPONENTS_PARAM_KEY,
  addInteriorComponent,
  buildInteriorComponentsPatch,
  readInteriorComponents,
  removeInteriorComponent,
  reorderInteriorComponents,
  setInteriorComponentEnabled,
  updateInteriorComponent,
} from "./patch";

export {
  assertUpdateOperationInvariant,
  interiorComponentOperationSchema,
  type InteriorComponentOperation,
} from "./ai-operations";

export {
  BIBB_FIXTURE_A,
  BIBB_FIXTURE_B_ISLAND,
  BIBB_FIXTURE_B_SINK,
  BIBB_FIXTURE_C,
  KLINT_ROLLOUT_FIXTURE,
} from "./fixtures";
