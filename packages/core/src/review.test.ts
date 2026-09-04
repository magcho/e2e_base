import { describe, expect, it } from "vitest";
import {
  annotateBindingChanges,
  classifySpanReviewItem,
  describeBindingChange,
  expandScenarioOccurrences,
  formatLocatorLabel,
  humanizeStepAction,
  listUnmappedPlanNodeIds,
  listUnmappedSourceSpanIds,
  parsePlaybook,
  summarizeReviewAttention,
  summarizeSpanReviewProgress,
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

describe("formatLocatorLabel", () => {
  it("renders role+name and css locators in human-readable form", () => {
    expect(formatLocatorLabel({ strategy: "role", value: "textbox", name: "名前入力" })).toBe(
      'role=textbox name="名前入力"',
    );
    expect(formatLocatorLabel({ strategy: "css", value: '[data-testid="名前入力"]' })).toBe(
      'css=[data-testid="名前入力"]',
    );
  });
});

describe("describeBindingChange", () => {
  it("summarizes which locator fields changed", () => {
    const previous: Binding = {
      id: "bnd_prev",
      targetId: "tgt",
      strategy: "accessible_name_exact",
      locator: { strategy: "role", value: "textbox", name: "名前入力" },
      confidence: 0.9,
      rationale: "prev",
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const current: Binding = {
      ...previous,
      id: "bnd_curr",
      locator: { strategy: "css", value: '[data-testid="名前入力"]' },
      rationale: "curr",
    };
    const desc = describeBindingChange({
      changed: true,
      previous,
      current,
      reason: "同一 Semantic Target が前回と異なる Binding へ Resolve された",
    });
    expect(desc.headline).toContain("strategy");
    expect(desc.previousLabel).toBe('role=textbox name="名前入力"');
    expect(desc.currentLabel).toBe('css=[data-testid="名前入力"]');
    expect(desc.changedFields).toEqual(expect.arrayContaining(["strategy", "value", "name"]));
  });
});

describe("summarizeReviewAttention", () => {
  it("separates execution pass from review signals", () => {
    const attention = summarizeReviewAttention({
      scenarioStatus: "passed",
      bindingChangeCount: 4,
      unmappedSpanCount: 1,
      unmappedPlanCount: 1,
      unexecutedPlanCount: 1,
    });
    expect(attention.executionLabel).toBe("passed");
    expect(attention.needsReview).toBe(true);
    expect(attention.reviewLabel).toContain("Binding変更 4");
    expect(attention.reviewLabel).toContain("未マッピング Source 1");
  });

  it("needsReview is false when there are no signals", () => {
    const attention = summarizeReviewAttention({
      scenarioStatus: "passed",
      bindingChangeCount: 0,
      unmappedSpanCount: 0,
      unmappedPlanCount: 0,
      unexecutedPlanCount: 0,
    });
    expect(attention.needsReview).toBe(false);
    expect(attention.reviewLabel).toBe("なし");
  });
});

describe("review judgment progress", () => {
  it("counts decided spans and scenario completion readiness", () => {
    const spanIds = ["a", "b", "c", "d"];
    const decisions = {
      a: { spanId: "a", verdict: "as_intended" as const },
      b: { spanId: "b", verdict: "needs_fix" as const },
    };
    const progress = summarizeSpanReviewProgress(spanIds, decisions);
    expect(progress.decidedCount).toBe(2);
    expect(progress.totalCount).toBe(4);
    expect(progress.allDecided).toBe(false);
    expect(progress.judgmentLabel).toBe("未完了");
  });

  it("marks judgment complete only when all spans decided and scenario completed", () => {
    const spanIds = ["a", "b"];
    const decisions = {
      a: { spanId: "a", verdict: "as_intended" as const },
      b: { spanId: "b", verdict: "deferred" as const },
    };
    expect(summarizeSpanReviewProgress(spanIds, decisions).allDecided).toBe(true);
    expect(summarizeSpanReviewProgress(spanIds, decisions).judgmentLabel).toBe("未完了");
    expect(
      summarizeSpanReviewProgress(spanIds, decisions, { scenarioCompleted: true }).judgmentLabel,
    ).toBe("レビュー済み");
  });

  it("classifies span review item status including missing mapping", () => {
    expect(
      classifySpanReviewItem({
        spanId: "x",
        linkedPlanCount: 0,
        decision: undefined,
        selectedSpanId: null,
      }),
    ).toBe("missing");
    expect(
      classifySpanReviewItem({
        spanId: "y",
        linkedPlanCount: 1,
        decision: undefined,
        selectedSpanId: "y",
      }),
    ).toBe("reviewing");
    expect(
      classifySpanReviewItem({
        spanId: "z",
        linkedPlanCount: 1,
        decision: { spanId: "z", verdict: "as_intended" },
        selectedSpanId: null,
      }),
    ).toBe("confirmed");
  });
});

describe("humanizeStepAction", () => {
  it("renders TYPE/CLICK/ASSERT in human language", () => {
    expect(
      humanizeStepAction({
        id: "1",
        type: "TYPE",
        target: { id: "t", kind: "semantic", description: "名前入力" },
        text: "magcho",
      }),
    ).toBe("「名前入力」に「magcho」を入力");
    expect(
      humanizeStepAction({
        id: "2",
        type: "CLICK",
        target: { id: "t", kind: "semantic", description: "送信ボタン" },
      }),
    ).toBe("「送信ボタン」をクリック");
  });
});
