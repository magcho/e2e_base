export type NodeId = string;

export type ResolutionStrategy =
  | "accessible_name_exact"
  | "role_name"
  | "ai_assisted"
  | "explicit_locator"
  | "heuristic_fallback";

export type LocatorStrategy = "role" | "css" | "text" | "testid";

export type SemanticTarget = {
  id: NodeId;
  kind: "semantic";
  description: string;
};

export type LocatorTarget = {
  id: NodeId;
  kind: "locator";
  strategy: LocatorStrategy;
  value: string;
  name?: string;
};

export type Target = SemanticTarget | LocatorTarget;

export type BindingLocator = {
  strategy: LocatorStrategy;
  value: string;
  name?: string;
};

export type Binding = {
  id: NodeId;
  targetId: NodeId;
  strategy: ResolutionStrategy;
  locator: BindingLocator;
  confidence: number;
  rationale: string;
  candidatesConsidered?: Array<{ label: string; score?: number }>;
  resolvedAt: string;
};

export type NavigateStep = {
  id: NodeId;
  type: "NAVIGATE";
  url: string;
};

export type ClickStep = {
  id: NodeId;
  type: "CLICK";
  target: Target;
};

export type TypeStep = {
  id: NodeId;
  type: "TYPE";
  target: Target;
  text: string;
};

export type AssertVisibleStep = {
  id: NodeId;
  type: "ASSERT";
  assertion: "visible";
  target: Target;
};

export type AssertTextStep = {
  id: NodeId;
  type: "ASSERT";
  assertion: "text";
  target: Target;
  expected: string;
};

export type CallStep = {
  id: NodeId;
  type: "CALL";
  toolName: string;
};

export type AssertStep = AssertVisibleStep | AssertTextStep;

export type Step =
  | NavigateStep
  | ClickStep
  | TypeStep
  | AssertStep
  | CallStep;

export type ExecutableStep = Exclude<Step, CallStep>;

export type Tool = {
  id: NodeId;
  name: string;
  steps: Step[];
};

export type Scenario = {
  id: NodeId;
  name: string;
  description?: string;
  steps: Step[];
};

export type Playbook = {
  id: NodeId;
  sourcePath?: string;
  tools: Tool[];
  scenarios: Scenario[];
};

export type BoundStep = {
  step: ExecutableStep;
  binding?: Binding;
};

export type Observation = {
  id: NodeId;
  stepId: NodeId;
  url?: string;
  screenshotPath?: string;
  visibleTextSample?: string;
  capturedAt: string;
};

export type Evaluation = {
  assertion?: "visible" | "text";
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
};

export type StepStatus = "passed" | "failed" | "skipped" | "error";

export type StepResult = {
  id: NodeId;
  stepId: NodeId;
  status: StepStatus;
  binding?: Binding;
  observation?: Observation;
  evaluation?: Evaluation;
  errorMessage?: string;
  durationMs: number;
};

export type ScenarioResult = {
  scenarioId: NodeId;
  scenarioName: string;
  status: "passed" | "failed";
  steps: StepResult[];
  startedAt: string;
  finishedAt: string;
};

export type PageCandidate = {
  id: string;
  role?: string;
  name?: string;
  text?: string;
  cssHint?: string;
};

export type PageSnapshot = {
  candidates: PageCandidate[];
};
