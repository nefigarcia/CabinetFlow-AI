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
  LinkedInteriorComponent,
  RolloutComponent,
  SinkPulloutComponent,
  SpiceRackComponent,
  SpongeTiltOutComponent,
  StandaloneInteriorComponent,
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
  INTERIOR_DEFINITION_ID_MAX_LENGTH,
  cabinetInteriorComponentSchema,
  cabinetInteriorComponentsArraySchema,
  interiorComponentTargetSchema,
  linkedInteriorComponentSchema,
  standaloneInteriorComponentSchema,
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
  isLinkedInteriorComponent,
  readInteriorComponentsSafe,
  removeInteriorComponent,
  reorderInteriorComponents,
  setInteriorComponentEnabled,
  updateInteriorComponent,
  type InteriorComponentsReadResult,
} from "./patch";

export {
  assertUpdateOperationInvariant,
  interiorComponentOperationSchema,
  type InteriorComponentOperation,
} from "./ai-operations";

export {
  enforceInteriorComponentsWritePolicy,
  validateIncomingCabinetParameters,
  type IncomingParametersValidationOptions,
  type IncomingParametersValidationResult,
  type InteriorWritePolicyResult,
} from "./server-validation";

export {
  BIBB_FIXTURE_A,
  BIBB_FIXTURE_B_ISLAND,
  BIBB_FIXTURE_B_SINK,
  BIBB_FIXTURE_C,
  KLINT_ROLLOUT_FIXTURE,
} from "./fixtures";
