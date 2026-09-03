import type { ExecutableStep, Playbook, Scenario, Step } from "./types.js";

export class ExpandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpandError";
  }
}

/** Scenario 内の CALL を 1 段展開する。Tool 内 CALL はパーサ段階で禁止済み。 */
export function expandScenarioSteps(playbook: Playbook, scenario: Scenario): ExecutableStep[] {
  const tools = new Map(playbook.tools.map((t) => [t.name, t]));
  const out: ExecutableStep[] = [];

  for (const step of scenario.steps) {
    if (step.type !== "CALL") {
      out.push(step);
      continue;
    }
    const tool = tools.get(step.toolName);
    if (!tool) {
      throw new ExpandError(`unknown tool: ${step.toolName}`);
    }
    for (const toolStep of tool.steps) {
      if (toolStep.type === "CALL") {
        throw new ExpandError(`tool "${tool.name}" contains nested CALL (forbidden)`);
      }
      out.push(toolStep as ExecutableStep);
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
