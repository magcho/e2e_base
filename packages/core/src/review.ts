import type {
  Binding,
  BindingChangeSignal,
  BindingLocator,
  NodeId,
  ScenarioResult,
  Step,
  StepResult,
} from "./types.js";

/** Source 文書の種類（PRODUCT_DIRECTION の SourceDocument.kind に対応） */
export type SourceKind = "natural-language" | "dsl" | "typescript" | "playwright";

export type SourceDocument = {
  id: string;
  kind: SourceKind;
  content: string;
  label?: string;
};

/** 文字オフセットによる Source Span（多対多 Mapping の片側） */
export type SourceSpan = {
  id: string;
  sourceDocumentId: string;
  /** content 内の開始インデックス（含む） */
  start: number;
  /** content 内の終了インデックス（含まない） */
  end: number;
  label?: string;
};

export type SourcePlanLink = {
  sourceSpanId: string;
  planNodeId: NodeId;
};

/** Playbook 上の宣言 Step（Tool 展開前）。CALL も 1 Plan Node。 */
export type PlanNodeView = {
  id: NodeId;
  label: string;
  stepType: Step["type"];
  /** 対応する宣言 Step の要約（表示用） */
  summary?: string;
};

export type { BindingChangeSignal };

/** Review Viewer への入力（Execution Result + Source Map） */
export type ReviewBundle = {
  sourceDocument: SourceDocument;
  sourceSpans: SourceSpan[];
  links: SourcePlanLink[];
  planNodes: PlanNodeView[];
  result: ScenarioResult;
  /** 画面上の実行ラベル（例: fixture-classic / fixture-alt） */
  runLabel?: string;
};

export type LocatorKey = string;

/** Binding の Locator を比較用キーにする */
export function bindingLocatorKey(binding: Binding): LocatorKey {
  const { strategy, value, name } = binding.locator;
  return `${strategy}|${value}|${name ?? ""}`;
}

export function isSameBindingLocator(a: Binding, b: Binding): boolean {
  return bindingLocatorKey(a) === bindingLocatorKey(b);
}

/**
 * 前回実行の Binding（occurrencePath → Binding）と比較し、
 * 変更があれば StepResult に bindingChange を付与したコピーを返す。
 * 実行は止めない前提の後処理。
 */
export function annotateBindingChanges(
  steps: StepResult[],
  previousByOccurrencePath: Record<string, Binding>,
): StepResult[] {
  return steps.map((step) => {
    const path = step.occurrencePath;
    if (!path || !step.binding) return step;
    const previous = previousByOccurrencePath[path];
    if (!previous) return step;
    if (isSameBindingLocator(previous, step.binding)) return step;
    const bindingChange: BindingChangeSignal = {
      changed: true,
      previous,
      current: step.binding,
      reason: "同一 Semantic Target が前回と異なる Binding へ Resolve された",
    };
    return { ...step, bindingChange };
  });
}

/** Locator をレビュー用の短いラベルにする */
export function formatLocatorLabel(locator: BindingLocator): string {
  if (locator.strategy === "role" && locator.name) {
    return `role=${locator.value} name="${locator.name}"`;
  }
  if (locator.name) {
    return `${locator.strategy}=${locator.value} name="${locator.name}"`;
  }
  return `${locator.strategy}=${locator.value}`;
}

export type BindingChangeDescription = {
  headline: string;
  previousLabel: string;
  currentLabel: string;
  changedFields: Array<"strategy" | "value" | "name">;
};

/** Binding 変更を人間が読める差分に要約する */
export function describeBindingChange(change: BindingChangeSignal): BindingChangeDescription {
  const prev = change.previous.locator;
  const curr = change.current.locator;
  const changedFields: Array<"strategy" | "value" | "name"> = [];
  if (prev.strategy !== curr.strategy) changedFields.push("strategy");
  if (prev.value !== curr.value) changedFields.push("value");
  if ((prev.name ?? "") !== (curr.name ?? "")) changedFields.push("name");
  const fieldLabel = changedFields.length > 0 ? changedFields.join(" / ") : "locator";
  return {
    headline: `Locator の ${fieldLabel} が変化`,
    previousLabel: formatLocatorLabel(prev),
    currentLabel: formatLocatorLabel(curr),
    changedFields,
  };
}

export type ReviewAttentionSummary = {
  executionLabel: "passed" | "failed";
  needsReview: boolean;
  reviewLabel: string;
};

/** 実行成否とレビューシグナルを分けて要約する */
export function summarizeReviewAttention(input: {
  scenarioStatus: "passed" | "failed";
  bindingChangeCount: number;
  unmappedSpanCount: number;
  unmappedPlanCount: number;
  unexecutedPlanCount: number;
}): ReviewAttentionSummary {
  const parts: string[] = [];
  if (input.bindingChangeCount > 0) parts.push(`Binding変更 ${input.bindingChangeCount}`);
  if (input.unmappedSpanCount > 0) parts.push(`未マッピング Source ${input.unmappedSpanCount}`);
  if (input.unmappedPlanCount > 0) parts.push(`未マッピング Plan ${input.unmappedPlanCount}`);
  if (input.unexecutedPlanCount > 0) parts.push(`未実行 ${input.unexecutedPlanCount}`);
  return {
    executionLabel: input.scenarioStatus,
    needsReview: parts.length > 0,
    reviewLabel: parts.length > 0 ? parts.join(" · ") : "なし",
  };
}

/** Plan Node のうち実行 occurrence が1つも無いものを列挙 */
export function listUnexecutedPlanNodeIds(
  planNodes: PlanNodeView[],
  steps: StepResult[],
): NodeId[] {
  const executed = new Set(
    steps
      .filter((s) => s.status !== "skipped")
      .map((s) => s.planNodeId)
      .filter(Boolean),
  );
  return planNodes.filter((p) => !executed.has(p.id)).map((p) => p.id);
}

/** どの Plan Node にもリンクされていない Source Span */
export function listUnmappedSourceSpanIds(spans: SourceSpan[], links: SourcePlanLink[]): string[] {
  const mapped = new Set(links.map((l) => l.sourceSpanId));
  return spans.filter((s) => !mapped.has(s.id)).map((s) => s.id);
}

/** どの Source にもリンクされていない Plan Node */
export function listUnmappedPlanNodeIds(
  planNodes: PlanNodeView[],
  links: SourcePlanLink[],
): NodeId[] {
  const mapped = new Set(links.map((l) => l.planNodeId));
  return planNodes.filter((p) => !mapped.has(p.id)).map((p) => p.id);
}

/** Scenario の宣言 Step から PlanNodeView を作る（表示用） */
export function planNodesFromScenarioSteps(steps: Step[]): PlanNodeView[] {
  return steps.map((step) => ({
    id: step.id,
    stepType: step.type,
    label: summarizeStep(step),
    summary: summarizeStep(step),
  }));
}

function summarizeStep(step: Step): string {
  switch (step.type) {
    case "NAVIGATE":
      return `NAVIGATE ${step.url}`;
    case "CLICK":
      return `CLICK ${targetLabel(step.target)}`;
    case "TYPE":
      return `TYPE ${targetLabel(step.target)}`;
    case "ASSERT":
      return step.assertion === "text"
        ? `ASSERT text ${targetLabel(step.target)}`
        : `ASSERT visible ${targetLabel(step.target)}`;
    case "CALL":
      return `CALL ${step.toolName}`;
    default: {
      const _exhaustive: never = step;
      return String(_exhaustive);
    }
  }
}

function targetLabel(target: { kind: string; description?: string; value?: string }): string {
  if (target.kind === "semantic" && target.description) return `"${target.description}"`;
  return target.value ?? "(target)";
}
