import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  childId,
  expandScenarioOccurrences,
  type Binding,
  type Evaluation,
  type ExecutableStep,
  type Observation,
  type ObservationPhase,
  type PageCandidate,
  type PageSnapshot,
  type Playbook,
  type Scenario,
  type ScenarioResult,
  type StepResult,
  type Target,
} from "@e2e-base/core";
import { resolveTarget, type TargetResolver } from "@e2e-base/resolver";
import { chromium, type Locator, type Page } from "playwright";

export type ExecuteOptions = {
  playbook: Playbook;
  scenario: Scenario;
  resolver: TargetResolver;
  artifactDir: string;
  headless?: boolean;
  baseURL?: string;
  /**
   * 失敗後も残り Step を skipped として結果に残す（既定 true）。
   * Binding 変更だけでは停止しない（変更検知は Reporter / annotateBindingChanges 側）。
   */
  recordSkippedOnFailure?: boolean;
};

async function collectCandidates(page: Page): Promise<PageSnapshot> {
  const candidates = await page.evaluate(() => {
    const out: Array<{
      id: string;
      role?: string;
      name?: string;
      text?: string;
      cssHint?: string;
    }> = [];

    const normalize = (s: string | null | undefined): string | undefined => {
      const t = (s ?? "").trim().replace(/\s+/g, " ");
      return t || undefined;
    };

    const associatedLabelText = (el: Element): string | undefined => {
      const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (input.labels && input.labels.length > 0) {
        return normalize(input.labels[0]?.textContent);
      }
      if (el.id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (byFor) return normalize(byFor.textContent);
      }
      return undefined;
    };

    const push = (el: Element, index: number, role?: string | null, name?: string | null) => {
      const text = normalize(el.textContent)?.slice(0, 80);
      const idAttr = el.id ? `#${el.id}` : undefined;
      const testId = el.getAttribute("data-testid");
      out.push({
        id: `cand_${index}`,
        role: role ?? undefined,
        name: normalize(name),
        text,
        cssHint: testId ? `[data-testid="${testId}"]` : idAttr,
      });
    };

    let i = 0;
    document
      .querySelectorAll(
        "button, [role='button'], input, textarea, select, a, [aria-label], label, h1, h2, h3, p, [data-testid]",
      )
      .forEach((el) => {
        const role =
          el.getAttribute("role") ||
          (el.tagName === "BUTTON"
            ? "button"
            : el.tagName === "A"
              ? "link"
              : el.tagName === "INPUT"
                ? (el as HTMLInputElement).type === "submit"
                  ? "button"
                  : "textbox"
                : el.tagName === "TEXTAREA"
                  ? "textbox"
                  : el.tagName === "SELECT"
                    ? "combobox"
                    : undefined);
        const name =
          el.getAttribute("aria-label") ||
          associatedLabelText(el) ||
          (el as HTMLElement).innerText ||
          (el as HTMLInputElement).value ||
          el.getAttribute("placeholder") ||
          el.textContent;
        push(el, i++, role, name);
      });

    return out;
  });

  // de-dupe by label-ish key while keeping order; interactive roles first
  const rank = (c: PageCandidate): number => {
    if (c.role === "button" || c.role === "link") return 0;
    if (c.role === "textbox" || c.role === "combobox") return 1;
    if (c.role) return 2;
    return 3;
  };
  const sorted = [...candidates].sort((a, b) => rank(a) - rank(b));

  const seen = new Set<string>();
  const unique: PageCandidate[] = [];
  for (const c of sorted) {
    const key = `${c.role}|${c.name}|${c.cssHint}|${c.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return { candidates: unique };
}

function locatorFromBinding(page: Page, binding: Binding): Locator {
  const { locator } = binding;
  switch (locator.strategy) {
    case "role":
      return page.getByRole(locator.value as Parameters<Page["getByRole"]>[0], {
        name: locator.name,
      });
    case "css":
      return page.locator(locator.value);
    case "text":
      return page.getByText(locator.value);
    case "testid":
      return page.getByTestId(locator.value);
    default:
      throw new Error(`unsupported locator strategy: ${String(locator.strategy)}`);
  }
}

async function captureObservation(
  page: Page,
  stepId: string,
  artifactDir: string,
  index: number,
  phase: ObservationPhase,
): Promise<Observation> {
  await mkdir(artifactDir, { recursive: true });
  const filename = `step-${String(index).padStart(3, "0")}-${phase}.png`;
  const screenshotPath = path.join(artifactDir, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const visibleTextSample = (await page.locator("body").innerText()).slice(0, 500);
  return {
    id: childId(stepId, "obs", index, phase),
    stepId,
    url: page.url(),
    screenshotPath,
    visibleTextSample,
    capturedAt: new Date().toISOString(),
    phase,
  };
}

async function ensureBinding(
  page: Page,
  step: ExecutableStep,
  resolver: TargetResolver,
): Promise<Binding | undefined> {
  if (step.type === "NAVIGATE") return undefined;
  const target: Target = step.target;
  const snapshot = await collectCandidates(page);
  return resolveTarget(target, snapshot, resolver);
}

async function evaluateAssertion(
  page: Page,
  step: Extract<ExecutableStep, { type: "ASSERT" }>,
  binding: Binding,
): Promise<Evaluation> {
  const loc = locatorFromBinding(page, binding);
  if (step.assertion === "visible") {
    const visible = await loc
      .first()
      .isVisible()
      .catch(() => false);
    return {
      assertion: "visible",
      passed: visible,
      message: visible ? "要素は可視" : "要素が可視ではない",
    };
  }
  const actual = (
    await loc
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
  const passed = actual.includes(step.expected);
  return {
    assertion: "text",
    passed,
    message: passed
      ? `テキストが期待を含む: ${step.expected}`
      : `テキスト不一致: expected includes "${step.expected}", actual="${actual}"`,
    expected: step.expected,
    actual,
  };
}

async function runStep(
  page: Page,
  step: ExecutableStep,
  resolver: TargetResolver,
  artifactDir: string,
  index: number,
  planNodeId: string,
  occurrencePath: string,
): Promise<StepResult> {
  const started = Date.now();
  let binding: Binding | undefined;
  const base = {
    planNodeId,
    occurrencePath,
  };
  try {
    if (step.type === "NAVIGATE") {
      const before = await captureObservation(page, step.id, artifactDir, index, "before");
      await page.goto(step.url, { waitUntil: "domcontentloaded" });
      const after = await captureObservation(page, step.id, artifactDir, index, "after");
      return {
        id: childId(step.id, "res", index),
        stepId: step.id,
        status: "passed",
        observation: after,
        observations: [before, after],
        durationMs: Date.now() - started,
        ...base,
      };
    }

    const before = await captureObservation(page, step.id, artifactDir, index, "before");
    binding = await ensureBinding(page, step, resolver);
    if (!binding) {
      throw new Error("binding missing for targeted step");
    }
    const loc = locatorFromBinding(page, binding);

    if (step.type === "CLICK") {
      await loc.first().click();
    } else if (step.type === "TYPE") {
      await loc.first().fill(step.text);
    } else if (step.type === "ASSERT") {
      const evaluation = await evaluateAssertion(page, step, binding);
      const assertionObs = await captureObservation(page, step.id, artifactDir, index, "assertion");
      return {
        id: childId(step.id, "res", index),
        stepId: step.id,
        status: evaluation.passed ? "passed" : "failed",
        binding,
        observation: assertionObs,
        observations: [before, assertionObs],
        evaluation,
        durationMs: Date.now() - started,
        errorMessage: evaluation.passed ? undefined : evaluation.message,
        ...base,
      };
    }

    const after = await captureObservation(page, step.id, artifactDir, index, "after");
    return {
      id: childId(step.id, "res", index),
      stepId: step.id,
      status: "passed",
      binding,
      observation: after,
      observations: [before, after],
      durationMs: Date.now() - started,
      ...base,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let observation: Observation | undefined;
    const observations: Observation[] = [];
    try {
      observation = await captureObservation(page, step.id, artifactDir, index, "error");
      observations.push(observation);
    } catch {
      // ignore screenshot failures on error path
    }
    return {
      id: childId(step.id, "res", index),
      stepId: step.id,
      status: "error",
      binding,
      observation,
      observations: observations.length > 0 ? observations : undefined,
      errorMessage: message,
      durationMs: Date.now() - started,
      ...base,
    };
  }
}

export async function executeScenario(options: ExecuteOptions): Promise<ScenarioResult> {
  const { playbook, scenario, resolver, artifactDir } = options;
  const occurrences = expandScenarioOccurrences(playbook, scenario);
  const startedAt = new Date().toISOString();
  await mkdir(artifactDir, { recursive: true });
  const recordSkipped = options.recordSkippedOnFailure ?? true;

  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext({ baseURL: options.baseURL });
  const page = await context.newPage();
  const results: StepResult[] = [];

  try {
    let halted = false;
    for (let i = 0; i < occurrences.length; i++) {
      const occ = occurrences[i]!;
      if (halted) {
        if (recordSkipped) {
          results.push({
            id: childId(occ.step.id, "res", i, "skipped"),
            stepId: occ.step.id,
            status: "skipped",
            durationMs: 0,
            planNodeId: occ.planNodeId,
            occurrencePath: occ.occurrencePath,
          });
        }
        continue;
      }
      const result = await runStep(
        page,
        occ.step,
        resolver,
        artifactDir,
        i,
        occ.planNodeId,
        occ.occurrencePath,
      );
      results.push(result);
      if (result.status === "failed" || result.status === "error") {
        // Binding 変更ではここに来ない。Assertion / 実行エラー時のみ後続を skipped にする。
        halted = true;
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.some((r) => r.status === "failed" || r.status === "error");
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: failed ? "failed" : "passed",
    steps: results,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
