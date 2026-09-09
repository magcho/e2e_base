export type NodeId = string;

export type ResolutionStrategy =
  "accessible_name_exact" | "role_name" | "ai_assisted" | "explicit_locator" | "heuristic_fallback";

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

export type Step = NavigateStep | ClickStep | TypeStep | AssertStep | CallStep;

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

/** Step 前後の観測フェーズ（Review Viewer 右カラム用） */
export type ObservationPhase = "before" | "after" | "assertion" | "error";

export type Observation = {
  id: NodeId;
  stepId: NodeId;
  url?: string;
  screenshotPath?: string;
  visibleTextSample?: string;
  capturedAt: string;
  /** 未指定時は after 相当（既存デモ互換） */
  phase?: ObservationPhase;
};

export type Evaluation = {
  assertion?: "visible" | "text";
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
};

export type StepStatus = "passed" | "failed" | "skipped" | "error";

/**
 * Binding 変更シグナル（Assertion 失敗とは別）。
 * core/review.ts の BindingChangeSignal と同形。循環を避けるため型をここに定義。
 */
export type BindingChangeSignal = {
  changed: true;
  previous: Binding;
  current: Binding;
  reason: string;
};

export type StepResult = {
  id: NodeId;
  stepId: NodeId;
  status: StepStatus;
  binding?: Binding;
  /**
   * 互換用の代表 Observation（通常は after / assertion / error）。
   * before/after 両方は observations を参照。
   */
  observation?: Observation;
  /** 実行前後などの Observation 列 */
  observations?: Observation[];
  evaluation?: Evaluation;
  errorMessage?: string;
  durationMs: number;
  /** Tool 展開前の Plan Node（Scenario 上の Step ID。CALL 展開時は CALL の ID） */
  planNodeId?: NodeId;
  /** 実行 occurrence の識別子（同一 Tool の複数呼び出しを区別） */
  occurrencePath?: string;
  /** 前回 Binding との差分（あればレビューシグナル） */
  bindingChange?: BindingChangeSignal;
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
