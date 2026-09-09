import type { ExecutableStep, Playbook, Scenario, Step } from "./types.js";

export class ExpandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpandError";
  }
}

/** Tool 展開後の実行 Step と、対応する Plan Node / occurrence の組 */
export type ExpandedStepOccurrence = {
  step: ExecutableStep;
  /** Scenario 上の宣言 Step ID（CALL 経由なら CALL の ID） */
  planNodeId: string;
  /** 例: scn/stp1:CALL/fill_contact#0/TYPE@0 */
  occurrencePath: string;
  /** 展開元の宣言 Step */
  planStep: Step;
};

/** Scenario 内の CALL を 1 段展開する。Tool 内 CALL はパーサ段階で禁止済み。 */
export function expandScenarioSteps(playbook: Playbook, scenario: Scenario): ExecutableStep[] {
  return expandScenarioOccurrences(playbook, scenario).map((o) => o.step);
}

/**
 * Plan Node（宣言 Step）と実行 occurrence を分けて返す。
 * 同一 Tool が複数回呼ばれても occurrencePath で区別できる。
 */
export function expandScenarioOccurrences(
  playbook: Playbook,
  scenario: Scenario,
): ExpandedStepOccurrence[] {
  const tools = new Map(playbook.tools.map((t) => [t.name, t]));
  const out: ExpandedStepOccurrence[] = [];
  const callCounts = new Map<string, number>();

  for (let si = 0; si < scenario.steps.length; si++) {
    const planStep = scenario.steps[si]!;
    if (planStep.type !== "CALL") {
      out.push({
        step: planStep,
        planNodeId: planStep.id,
        occurrencePath: `scn/stp${si}:${planStep.type}`,
        planStep,
      });
      continue;
    }

    const tool = tools.get(planStep.toolName);
    if (!tool) {
      throw new ExpandError(`unknown tool: ${planStep.toolName}`);
    }
    const callIndex = callCounts.get(planStep.toolName) ?? 0;
    callCounts.set(planStep.toolName, callIndex + 1);

    for (let ti = 0; ti < tool.steps.length; ti++) {
      const toolStep = tool.steps[ti]!;
      if (toolStep.type === "CALL") {
        throw new ExpandError(`tool "${tool.name}" contains nested CALL (forbidden)`);
      }
      out.push({
        step: toolStep as ExecutableStep,
        planNodeId: planStep.id,
        occurrencePath: `scn/stp${si}:CALL/${planStep.toolName}#${callIndex}/${toolStep.type}@${ti}`,
        planStep,
      });
    }
  }

  return out;
}

export function assertNoNestedCalls(steps: Step[]): void {
  for (const step of steps) {
    if (step.type === "CALL") {
      // allowed only at scenario level; callers decide
    }
  }
}
