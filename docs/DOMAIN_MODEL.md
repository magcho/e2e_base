# DOMAIN_MODEL — データモデル

本ドキュメントは MVP でコード化する型の仕様である。実装は `@e2e-base/core` に置く。

## 識別子（Provenance の土台）

```ts
type NodeId = string; // 例: "scn_01H.../stp_0003"
```

- Playbook / Scenario / Tool / Step / Target / Binding / StepResult に Stable ID を付与する。
- パーサが生成する ID は、同一入力に対して **決定的**（再現可能）であること。
- 実行時 Binding / StepResult の ID は実行ごとに新規でもよいが、親 NodeId を参照する。

## Semantic Target と Binding

```ts
type SemanticTarget = {
  id: NodeId;
  kind: "semantic";
  description: string; // 例: "送信ボタン"
};

type LocatorTarget = {
  id: NodeId;
  kind: "locator";
  strategy: "role" | "css" | "text" | "testid";
  value: string;
  name?: string; // role 用
};

type Target = SemanticTarget | LocatorTarget;

type ResolutionStrategy =
  | "accessible_name_exact"
  | "role_name"
  | "ai_assisted"
  | "explicit_locator"
  | "heuristic_fallback";

type Binding = {
  id: NodeId;
  targetId: NodeId;
  strategy: ResolutionStrategy;
  locator: {
    strategy: "role" | "css" | "text" | "testid";
    value: string;
    name?: string;
  };
  confidence: number; // 0..1
  rationale: string;
  candidatesConsidered?: Array<{ label: string; score?: number }>;
  resolvedAt: string; // ISO
};
```

MVP では Binding の永続化は必須ではないが、**型としては常に存在する**。実行中はメモリ上のマップで保持する。

## Step 語彙（MVP）

```ts
type NavigateStep = {
  id: NodeId;
  type: "NAVIGATE";
  url: string;
};

type ClickStep = {
  id: NodeId;
  type: "CLICK";
  target: Target;
};

type TypeStep = {
  id: NodeId;
  type: "TYPE";
  target: Target;
  text: string;
};

type AssertVisibleStep = {
  id: NodeId;
  type: "ASSERT";
  assertion: "visible";
  target: Target;
};

type AssertTextStep = {
  id: NodeId;
  type: "ASSERT";
  assertion: "text";
  target: Target;
  expected: string;
};

type CallStep = {
  id: NodeId;
  type: "CALL";
  toolName: string;
};

type Step =
  | NavigateStep
  | ClickStep
  | TypeStep
  | AssertVisibleStep
  | AssertTextStep
  | CallStep;
```

## Tool / Scenario / Playbook

```ts
type Tool = {
  id: NodeId;
  name: string;
  steps: Step[]; // CALL を含まない（展開時に検証）。再帰禁止。
};

type Scenario = {
  id: NodeId;
  name: string;
  description?: string;
  steps: Step[];
};

type Playbook = {
  id: NodeId;
  sourcePath?: string;
  tools: Tool[];
  scenarios: Scenario[];
};
```

制約:

- Scenario は最小独立実行単位（TestCase / beforeEach なし）
- Tool は Step 列の名前付き再利用。展開は 1 段のみ（Tool 内 CALL 禁止）
- Tool 失敗は呼び出し元 Scenario に伝播

## Bound Step

Resolution 後の実行入力。

```ts
type BoundStep = {
  step: Exclude<Step, CallStep>; // CALL は展開済み
  binding?: Binding; // NAVIGATE 以外で target がある場合
};
```

## Observation / Evaluation / Evidence

```ts
type Observation = {
  id: NodeId;
  stepId: NodeId;
  url?: string;
  screenshotPath?: string;
  visibleTextSample?: string;
  capturedAt: string;
};

type Evaluation = {
  assertion?: "visible" | "text";
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
};

type StepResult = {
  id: NodeId;
  stepId: NodeId;
  status: "passed" | "failed" | "skipped" | "error";
  binding?: Binding;
  observation?: Observation;
  evaluation?: Evaluation;
  errorMessage?: string;
  durationMs: number;
};

type ScenarioResult = {
  scenarioId: NodeId;
  scenarioName: string;
  status: "passed" | "failed";
  steps: StepResult[];
  startedAt: string;
  finishedAt: string;
};
```

- **Assertion**: Playbook 上の期待宣言（`ASSERT visible` 等）
- **Evaluator**: 実行時に Observation と Assertion を突き合わせる関数（executor 内）
- **Evidence**: ScenarioResult（+ 添付ファイル）をレポート入力として扱う束

## Resolver インターフェース

```ts
interface TargetResolver {
  resolve(input: {
    target: SemanticTarget;
    pageSnapshot: {
      candidates: Array<{
        id: string;
        role?: string;
        name?: string;
        text?: string;
        cssHint?: string;
      }>;
    };
  }): Promise<Binding>;
}
```

実装:

- `HeuristicResolver` — accessible name 完全一致など（常に利用可能）
- `AiAssistedResolver` — API キーがあるとき候補選択に LLM を使う
- `CompositeResolver` — heuristic → AI の Progressive Resolution
