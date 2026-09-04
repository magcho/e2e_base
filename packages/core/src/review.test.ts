import { describe, expect, it } from "vitest";
import {
  annotateBindingChanges,
  expandScenarioOccurrences,
  listUnmappedPlanNodeIds,
  listUnmappedSourceSpanIds,
  parsePlaybook,
  type Binding,
} from "../src/index.js";

const SAMPLE = `
playbook "demo"

tool fill_form
  TYPE "名前入力" "magcho"
  TYPE "メール入力" "magcho@example.com"
end

scenario "送信まで"
  NAVIGATE "http://127.0.0.1:4173/"
  CALL fill_form
  CLICK "送信ボタン"
end
`;

describe("expandScenarioOccurrences", () => {
  it("keeps CALL planNodeId for expanded tool steps and unique occurrencePath", () => {
    const pb = parsePlaybook(SAMPLE);
    const scenario = pb.scenarios[0]!;
    const occ = expandScenarioOccurrences(pb, scenario);
    expect(occ.map((o) => o.step.type)).toEqual(["NAVIGATE", "TYPE", "TYPE", "CLICK"]);
    const callStep = scenario.steps[1]!;
    expect(occ[1]!.planNodeId).toBe(callStep.id);
    expect(occ[2]!.planNodeId).toBe(callStep.id);
    expect(occ[1]!.occurrencePath).not.toBe(occ[2]!.occurrencePath);
    expect(occ[1]!.occurrencePath).toContain("CALL/fill_form#0/TYPE@0");
  });
});

describe("annotateBindingChanges", () => {
  it("flags locator differences without treating them as assertion failures", () => {
    const previous: Binding = {
      id: "bnd_prev",
      targetId: "tgt",
      strategy: "accessible_name_exact",
      locator: { strategy: "role", value: "button", name: "送信ボタン" },
      confidence: 0.9,
      rationale: "prev",
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const current: Binding = {
      ...previous,
      id: "bnd_curr",
      locator: { strategy: "css", value: '[data-testid="送信ボタン"]' },
      rationale: "curr",
    };
    const annotated = annotateBindingChanges(
      [
        {
          id: "res1",
          stepId: "stp",
          status: "passed",
          binding: current,
          durationMs: 10,
          occurrencePath: "scn/stp2:CLICK",
        },
      ],
      { "scn/stp2:CLICK": previous },
    );
    expect(annotated[0]!.status).toBe("passed");
    expect(annotated[0]!.bindingChange?.changed).toBe(true);
    expect(annotated[0]!.bindingChange?.previous.locator.strategy).toBe("role");
    expect(annotated[0]!.bindingChange?.current.locator.strategy).toBe("css");
  });
});

describe("mapping coverage helpers", () => {
  it("detects unmapped spans and plan nodes", () => {
    const spans = [
      {
        id: "a",
        sourceDocumentId: "s",
        start: 0,
        end: 1,
      },
      {
        id: "b",
        sourceDocumentId: "s",
        start: 1,
        end: 2,
      },
    ];
    const plans = [
      { id: "p1", label: "x", stepType: "CLICK" as const },
      { id: "p2", label: "y", stepType: "ASSERT" as const },
    ];
    const links = [{ sourceSpanId: "a", planNodeId: "p1" }];
    expect(listUnmappedSourceSpanIds(spans, links)).toEqual(["b"]);
    expect(listUnmappedPlanNodeIds(plans, links)).toEqual(["p2"]);
  });
});
