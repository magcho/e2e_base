import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioResult, StepResult } from "@e2e-base/core";
import {
  describeBindingChange,
  formatLocatorLabel,
  listUnexecutedPlanNodeIds,
  listUnmappedPlanNodeIds,
  listUnmappedSourceSpanIds,
  summarizeReviewAttention,
  type ReviewBundle,
} from "@e2e-base/core";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusBadge(status: string): string {
  const color =
    status === "passed"
      ? "#0a7f3f"
      : status === "failed" || status === "error"
        ? "#b00020"
        : status === "skipped"
          ? "#6b7280"
          : "#666";
  return `<span class="badge" style="background:${color}">${escapeHtml(status)}</span>`;
}

function stepBlock(step: StepResult, reportDir: string, index: number): string {
  const binding = step.binding
    ? `
      <div class="meta">
        <div><strong>Resolution strategy</strong>: ${escapeHtml(step.binding.strategy)}</div>
        <div><strong>Confidence</strong>: ${step.binding.confidence}</div>
        <div><strong>Locator</strong>: ${escapeHtml(JSON.stringify(step.binding.locator))}</div>
        <div><strong>Rationale</strong>: ${escapeHtml(step.binding.rationale)}</div>
        ${
          step.binding.candidatesConsidered?.length
            ? `<details><summary>Candidates considered</summary><ul>${step.binding.candidatesConsidered
                .map(
                  (c) =>
                    `<li>${escapeHtml(c.label)}${c.score != null ? ` (score=${c.score})` : ""}</li>`,
                )
                .join("")}</ul></details>`
            : ""
        }
      </div>`
    : `<div class="meta"><em>Binding なし（NAVIGATE 等）</em></div>`;

  const evaluation = step.evaluation
    ? `<div class="meta"><strong>Evaluation</strong>: ${escapeHtml(step.evaluation.message)}${
        step.evaluation.expected != null
          ? ` / expected=${escapeHtml(step.evaluation.expected)} actual=${escapeHtml(
              step.evaluation.actual ?? "",
            )}`
          : ""
      }</div>`
    : "";

  let screenshot = "";
  if (step.observation?.screenshotPath) {
    const rel = path.relative(reportDir, step.observation.screenshotPath);
    screenshot = `<div class="shot"><img src="${escapeHtml(rel)}" alt="step ${index} screenshot" /></div>`;
  }

  return `
  <section class="step">
    <h3>Step ${index + 1} ${statusBadge(step.status)} <code>${escapeHtml(step.stepId)}</code></h3>
    <div class="meta"><strong>Duration</strong>: ${step.durationMs}ms</div>
    ${step.errorMessage ? `<div class="error">${escapeHtml(step.errorMessage)}</div>` : ""}
    ${binding}
    ${evaluation}
    ${
      step.observation
        ? `<div class="meta"><strong>URL</strong>: ${escapeHtml(step.observation.url ?? "")}</div>`
        : ""
    }
    ${screenshot}
  </section>`;
}

export type RenderReportOptions = {
  result: ScenarioResult;
  outputPath: string;
  playbookPath?: string;
};

/** 既存 MVP デモ用の線形 Evidence Report（後方互換） */
export async function writeHtmlReport(options: RenderReportOptions): Promise<string> {
  const { result, outputPath, playbookPath } = options;
  const reportDir = path.dirname(outputPath);
  await mkdir(reportDir, { recursive: true });

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>e2e_base Report — ${escapeHtml(result.scenarioName)}</title>
  <style>
    :root { color-scheme: light; font-family: "IBM Plex Sans", "Noto Sans JP", sans-serif; }
    body { margin: 0; background: linear-gradient(180deg, #f7f3ea 0%, #eef2f4 40%, #e8eef2 100%); color: #1c2430; }
    main { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    h1 { font-family: "IBM Plex Serif", "Source Han Serif", serif; font-weight: 600; letter-spacing: -0.02em; }
    .badge { color: #fff; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
    .step { background: rgba(255,255,255,0.72); border: 1px solid #d5dde5; padding: 1rem 1.1rem; margin: 1rem 0; }
    .meta { margin: 0.35rem 0; font-size: 0.95rem; line-height: 1.45; }
    .error { color: #b00020; margin: 0.5rem 0; }
    .shot img { max-width: 100%; border: 1px solid #cfd8e3; margin-top: 0.75rem; }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.85em; }
    header p { color: #445066; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>e2e_base Evidence Report</h1>
      <p>Scenario: <strong>${escapeHtml(result.scenarioName)}</strong> ${statusBadge(result.status)}</p>
      <p>ID: <code>${escapeHtml(result.scenarioId)}</code></p>
      ${playbookPath ? `<p>Playbook: <code>${escapeHtml(playbookPath)}</code></p>` : ""}
      <p>${escapeHtml(result.startedAt)} → ${escapeHtml(result.finishedAt)}</p>
    </header>
    ${result.steps.map((s, i) => stepBlock(s, reportDir, i)).join("\n")}
  </main>
</body>
</html>`;

  await writeFile(outputPath, html, "utf8");
  return outputPath;
}

function relShot(reportDir: string, abs?: string): string | undefined {
  if (!abs) return undefined;
  return path.relative(reportDir, abs);
}

export type CompareRunLink = {
  label: string;
  href: string;
  active?: boolean;
};

export type RenderReviewReportOptions = {
  bundle: ReviewBundle;
  outputPath: string;
  playbookPath?: string;
  /** classic / alt など比較用 Run へのリンク */
  compareRuns?: CompareRunLink[];
};

function shortOccurrenceLabel(occurrencePath: string | undefined, fallback: string): string {
  if (!occurrencePath) return fallback;
  return occurrencePath.split("/").pop() ?? occurrencePath;
}

function buildInlineSourceHtml(
  content: string,
  spans: ReviewBundle["sourceSpans"],
  spanToPlans: Map<string, string[]>,
  unmappedSpans: Set<string>,
): string {
  const ordered = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0;
  let html = "";
  for (const span of ordered) {
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      html += escapeHtml(content.slice(cursor, span.start));
    }
    const plans = (spanToPlans.get(span.id) ?? []).join(" ");
    const unmapped = unmappedSpans.has(span.id);
    const text = content.slice(span.start, span.end);
    html += `<button type="button" class="src-inline ${unmapped ? "unmapped" : ""}" data-span-id="${escapeHtml(span.id)}" data-plan-ids="${escapeHtml(plans)}" title="${escapeHtml(span.label ?? span.id)}">${escapeHtml(text)}</button>`;
    cursor = span.end;
  }
  if (cursor < content.length) {
    html += escapeHtml(content.slice(cursor));
  }
  return html;
}

/**
 * 3 カラム Review Viewer。
 * 左: Source / 中: Plan+Execution / 右: Observation
 */
export async function writeReviewHtmlReport(options: RenderReviewReportOptions): Promise<string> {
  const { bundle, outputPath, playbookPath, compareRuns } = options;
  const reportDir = path.dirname(outputPath);
  await mkdir(reportDir, { recursive: true });

  const { sourceDocument, sourceSpans, links, planNodes, result } = bundle;
  const unmappedSpanIds = listUnmappedSourceSpanIds(sourceSpans, links);
  const unmappedPlanIds = listUnmappedPlanNodeIds(planNodes, links);
  const unexecutedPlanIds = listUnexecutedPlanNodeIds(planNodes, result.steps);
  const unmappedSpans = new Set(unmappedSpanIds);
  const unmappedPlans = new Set(unmappedPlanIds);
  const unexecutedPlans = new Set(unexecutedPlanIds);
  const bindingChangeCount = result.steps.filter((s) => s.bindingChange).length;
  const attention = summarizeReviewAttention({
    scenarioStatus: result.status,
    bindingChangeCount,
    unmappedSpanCount: unmappedSpanIds.length,
    unmappedPlanCount: unmappedPlanIds.length,
    unexecutedPlanCount: unexecutedPlanIds.length,
  });

  const spanToPlans = new Map<string, string[]>();
  const planToSpans = new Map<string, string[]>();
  for (const link of links) {
    const ps = spanToPlans.get(link.sourceSpanId) ?? [];
    ps.push(link.planNodeId);
    spanToPlans.set(link.sourceSpanId, ps);
    const ss = planToSpans.get(link.planNodeId) ?? [];
    ss.push(link.sourceSpanId);
    planToSpans.set(link.planNodeId, ss);
  }

  const inlineSource = buildInlineSourceHtml(
    sourceDocument.content,
    sourceSpans,
    spanToPlans,
    unmappedSpans,
  );

  const sourceBlocks = sourceSpans
    .map((span) => {
      const text = sourceDocument.content.slice(span.start, span.end);
      const plans = spanToPlans.get(span.id) ?? [];
      const flags = [unmappedSpans.has(span.id) ? "unmapped" : ""].filter(Boolean).join(" ");
      const mapHint = unmappedSpans.has(span.id)
        ? `<div class="hint">意図はあるが Plan に落としていない</div>`
        : `<div class="hint">→ Plan ${plans.length} 件</div>`;
      return `<button type="button" class="src-span ${flags}" data-span-id="${escapeHtml(span.id)}" data-plan-ids="${escapeHtml(plans.join(" "))}" title="${escapeHtml(span.label ?? span.id)}">
  <span class="span-label">${escapeHtml(span.label ?? span.id)}${unmappedSpans.has(span.id) ? ' <em class="flag">未マッピング</em>' : ""}</span>
  <span class="span-text">${escapeHtml(text)}</span>
  ${mapHint}
</button>`;
    })
    .join("\n");

  const planBlocks = planNodes
    .map((plan) => {
      const spanIds = planToSpans.get(plan.id) ?? [];
      const spans = spanIds.join(" ");
      const execs = result.steps.filter((s) => s.planNodeId === plan.id);
      const flags = [
        unmappedPlans.has(plan.id) ? "unmapped" : "",
        unexecutedPlans.has(plan.id) ? "unexecuted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      let statusHint = "";
      if (unmappedPlans.has(plan.id) && unexecutedPlans.has(plan.id)) {
        statusHint = `<div class="hint">Plan はあるが Source 根拠がなく、未実行</div>`;
      } else if (unmappedPlans.has(plan.id)) {
        statusHint = `<div class="hint">Plan はあるが Source に根拠がない</div>`;
      } else if (unexecutedPlans.has(plan.id)) {
        statusHint = `<div class="hint">宣言されたが実行されていない</div>`;
      }
      const meta = `<div class="plan-meta">宣言 Step · Source ${spanIds.length} · occurrence ${execs.length}</div>`;
      const execHtml =
        execs.length === 0
          ? `<div class="exec-empty">実行 occurrence なし</div>`
          : execs
              .map((ex, i) => {
                const short = shortOccurrenceLabel(ex.occurrencePath, ex.stepId);
                const bindChange = ex.bindingChange
                  ? `<span class="bind-pill" title="${escapeHtml(ex.bindingChange.reason)}">⚠ Binding</span>`
                  : "";
                return `<button type="button" class="exec-step ${ex.bindingChange ? "binding-changed" : ""}" data-step-id="${escapeHtml(ex.id)}" data-plan-id="${escapeHtml(plan.id)}" data-span-ids="${escapeHtml(spans)}" data-occ="${escapeHtml(ex.occurrencePath ?? "")}">
  <span class="occ-index">#${i + 1}</span>
  ${statusBadge(ex.status)}
  <code title="${escapeHtml(ex.occurrencePath ?? ex.stepId)}">${escapeHtml(short)}</code>
  ${bindChange}
</button>`;
              })
              .join("");
      return `<div class="plan-node ${flags}" data-plan-id="${escapeHtml(plan.id)}" data-span-ids="${escapeHtml(spans)}">
  <div class="plan-head">
    <span class="plan-kind">Plan</span>
    <strong>${escapeHtml(plan.label)}</strong>
    ${unmappedPlans.has(plan.id) ? '<em class="flag">未マッピング</em>' : ""}
    ${unexecutedPlans.has(plan.id) ? '<em class="flag">未実行</em>' : ""}
  </div>
  ${meta}
  ${statusHint}
  <div class="exec-list"><div class="exec-label">Execution</div>${execHtml}</div>
</div>`;
    })
    .join("\n");

  const compareNav =
    compareRuns && compareRuns.length > 0
      ? `<nav class="compare-runs">${compareRuns
          .map((r) =>
            r.active
              ? `<span class="run-chip active">${escapeHtml(r.label)}</span>`
              : `<a class="run-chip" href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a>`,
          )
          .join("")}</nav>`
      : "";

  const observationPayload = result.steps.map((step) => {
    const obs = (step.observations ?? (step.observation ? [step.observation] : [])).map((o) => ({
      phase: o.phase ?? "after",
      url: o.url ?? "",
      screenshot: relShot(reportDir, o.screenshotPath) ?? "",
      text: o.visibleTextSample ?? "",
    }));
    const change = step.bindingChange ? describeBindingChange(step.bindingChange) : null;
    return {
      id: step.id,
      planNodeId: step.planNodeId ?? "",
      status: step.status,
      occurrencePath: step.occurrencePath ?? "",
      binding: step.binding
        ? {
            strategy: step.binding.strategy,
            locatorLabel: formatLocatorLabel(step.binding.locator),
            rationale: step.binding.rationale,
          }
        : null,
      bindingChange: step.bindingChange
        ? {
            reason: step.bindingChange.reason,
            headline: change!.headline,
            previousLabel: change!.previousLabel,
            currentLabel: change!.currentLabel,
            changedFields: change!.changedFields,
          }
        : null,
      evaluation: step.evaluation
        ? {
            message: step.evaluation.message,
            expected: step.evaluation.expected ?? "",
            actual: step.evaluation.actual ?? "",
            passed: step.evaluation.passed,
          }
        : null,
      errorMessage: step.errorMessage ?? "",
      observations: obs,
    };
  });

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>Review Viewer — ${escapeHtml(result.scenarioName)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1a2330;
      --muted: #5a6a7a;
      --line: #c9d4df;
      --panel: rgba(255,255,255,0.88);
      --hl: #ffe6a8;
      --hl-strong: #ffd36b;
      --warn: #9a5b00;
      --warn-bg: #fff3d6;
      --flag: #8a2f2f;
      --review: #7a4b00;
      --review-bg: #fff8e8;
      font-family: "IBM Plex Sans", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at 0% 0%, #d9ecff 0%, transparent 42%),
        radial-gradient(circle at 100% 0%, #e7f6ef 0%, transparent 40%),
        linear-gradient(180deg, #f3f6f9, #e8eef3);
      min-height: 100vh;
    }
    header.app {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,0.78);
      backdrop-filter: blur(6px);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    header.app h1 {
      margin: 0 0 0.4rem;
      font-size: 1.2rem;
      font-family: "IBM Plex Serif", "Source Han Serif", serif;
    }
    header.app p { margin: 0.15rem 0; color: var(--muted); font-size: 0.88rem; }
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      margin: 0.45rem 0 0.25rem;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 6px;
      padding: 0.28rem 0.55rem;
      font-size: 0.85rem;
    }
    .status-pill .k { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .status-pill.review-needed {
      border-color: #e0b84e;
      background: var(--review-bg);
      color: var(--review);
      font-weight: 600;
    }
    .status-pill.review-clear { color: #0a7f3f; }
    .badge { color: #fff; padding: 0.12rem 0.45rem; border-radius: 4px; font-size: 0.75rem; }
    .compare-runs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.45rem; }
    .run-chip {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 0.8rem;
      text-decoration: none;
      color: var(--ink);
      background: #fff;
    }
    .run-chip.active { background: var(--hl-strong); border-color: #c7921a; font-weight: 600; }
    .layout {
      display: grid;
      grid-template-columns: minmax(240px, 1.05fr) minmax(280px, 1.15fr) minmax(300px, 1.15fr);
      gap: 0;
      min-height: calc(100vh - 140px);
    }
    .col {
      border-right: 1px solid var(--line);
      padding: 0.85rem;
      overflow: auto;
      max-height: calc(100vh - 140px);
    }
    .col:last-child { border-right: 0; }
    .col h2 {
      margin: 0 0 0.55rem;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .source-doc {
      white-space: pre-wrap;
      line-height: 1.55;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      font-size: 0.92rem;
    }
    .src-inline {
      display: inline;
      margin: 0;
      padding: 0.05rem 0.15rem;
      border: none;
      border-bottom: 2px solid #c9a227;
      background: rgba(255, 227, 140, 0.35);
      border-radius: 2px;
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    .src-inline.unmapped {
      border-bottom-color: #c45a5a;
      background: rgba(255, 210, 210, 0.45);
    }
    .src-inline.preview, .src-inline.active {
      background: var(--hl-strong);
    }
    .src-span, .exec-step, .plan-node {
      display: block;
      width: 100%;
      text-align: left;
      border: 1px solid var(--line);
      background: var(--panel);
      margin: 0.45rem 0;
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      color: inherit;
      transition: background 0.12s ease, box-shadow 0.12s ease;
    }
    .src-span:hover, .exec-step:hover, .plan-node:hover,
    .src-span.preview, .exec-step.preview, .plan-node.preview {
      background: var(--hl);
    }
    .src-span.active, .exec-step.active, .plan-node.active {
      background: var(--hl-strong);
      box-shadow: inset 0 0 0 2px #c7921a;
    }
    .span-label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.2rem; }
    .span-text { white-space: pre-wrap; }
    .hint { font-size: 0.75rem; color: var(--muted); margin-top: 0.3rem; }
    .flag { color: var(--flag); font-style: normal; font-size: 0.75rem; margin-left: 0.35rem; }
    .src-span.unmapped, .plan-node.unmapped { border-style: dashed; }
    .plan-node.unexecuted { opacity: 0.78; }
    .plan-head { margin-bottom: 0.2rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; }
    .plan-kind {
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #3d5a80;
      background: #e8f0fa;
      border-radius: 3px;
      padding: 0.08rem 0.35rem;
    }
    .plan-meta { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.35rem; }
    .exec-list {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin-left: 0.55rem;
      padding-left: 0.55rem;
      border-left: 2px solid #b7c7d8;
    }
    .exec-label {
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .exec-step {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      align-items: center;
    }
    .occ-index { font-size: 0.72rem; color: var(--muted); min-width: 1.4rem; }
    .exec-step.binding-changed { border-color: #d4a017; background: var(--warn-bg); }
    .bind-pill {
      color: var(--warn);
      font-size: 0.72rem;
      font-weight: 700;
      border: 1px solid #e0b84e;
      border-radius: 999px;
      padding: 0.05rem 0.4rem;
      background: #fff;
    }
    .exec-empty { font-size: 0.85rem; color: var(--muted); }
    #obs-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.75rem;
      min-height: 12rem;
    }
    #obs-panel .muted { color: var(--muted); }
    .assert-box {
      border: 1px solid var(--line);
      background: #f7fafc;
      border-radius: 6px;
      padding: 0.55rem 0.65rem;
      margin: 0.5rem 0;
    }
    .assert-box.failed { border-color: #e3a0a8; background: #fff5f5; }
    .assert-grid {
      display: grid;
      grid-template-columns: 4.5rem 1fr;
      gap: 0.25rem 0.5rem;
      font-size: 0.86rem;
      margin-top: 0.35rem;
    }
    .assert-grid .k { color: var(--muted); }
    .phase-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.55rem;
      margin-top: 0.55rem;
    }
    .phase-card {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0.45rem;
      background: #fff;
    }
    .phase-card h3 {
      margin: 0 0 0.35rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      font-weight: 600;
    }
    .phase-card img { max-width: 100%; border: 1px solid var(--line); display: block; }
    .phase-card .url { font-size: 0.75rem; color: var(--muted); word-break: break-all; margin-bottom: 0.3rem; }
    .meta { font-size: 0.88rem; line-height: 1.45; margin: 0.35rem 0; }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.8em; }
    .warn-box {
      background: var(--warn-bg);
      border: 1px solid #e0b84e;
      color: var(--warn);
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      margin: 0.5rem 0;
      font-size: 0.88rem;
    }
    .diff-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.4rem;
      font-size: 0.82rem;
    }
    .diff-table th, .diff-table td {
      border: 1px solid #e5d3a0;
      padding: 0.28rem 0.4rem;
      text-align: left;
      vertical-align: top;
    }
    .diff-table th { background: #fff8e0; color: var(--muted); font-weight: 600; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .col { max-height: none; border-right: 0; border-bottom: 1px solid var(--line); }
      .phase-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="app">
    <h1>Review Viewer（Source / Plan / Observation）</h1>
    <p>Scenario: <strong>${escapeHtml(result.scenarioName)}</strong>
      ${bundle.runLabel ? `· Run: <code>${escapeHtml(bundle.runLabel)}</code>` : ""}</p>
    <div class="status-row">
      <div class="status-pill">
        <span class="k">実行</span>
        ${statusBadge(attention.executionLabel)}
      </div>
      <div class="status-pill ${attention.needsReview ? "review-needed" : "review-clear"}">
        <span class="k">要レビュー</span>
        <span>${escapeHtml(attention.reviewLabel)}</span>
      </div>
    </div>
    <p>ID: <code>${escapeHtml(result.scenarioId)}</code>
      ${playbookPath ? `· Playbook: <code>${escapeHtml(playbookPath)}</code>` : ""}</p>
    <p>Span / Plan / Step をホバーで対応プレビュー、クリックで固定。Binding 変更は実行停止せずレビューシグナル。</p>
    ${compareNav}
  </header>
  <div class="layout">
    <section class="col" id="col-source">
      <h2>Source</h2>
      <p class="meta">${escapeHtml(sourceDocument.label ?? sourceDocument.id)} · ${escapeHtml(sourceDocument.kind)}</p>
      <div class="source-doc">${inlineSource}</div>
      <h2>Spans</h2>
      ${sourceBlocks}
    </section>
    <section class="col" id="col-plan">
      <h2>Plan / Execution Trace</h2>
      ${planBlocks}
    </section>
    <section class="col" id="col-obs">
      <h2>Observation</h2>
      <div id="obs-panel"><p class="muted">Step を選択すると、実行前後の Screenshot と Assertion を表示します。</p></div>
    </section>
  </div>
  <script type="application/json" id="obs-data">${JSON.stringify(observationPayload).replaceAll("<", "\\u003c")}</script>
  <script>
    (function () {
      const steps = JSON.parse(document.getElementById("obs-data").textContent);
      const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
      let selectedStepId = null;
      let selectedSpanId = null;
      let selectedPlanId = null;

      function clearPreview() {
        document.querySelectorAll(".preview").forEach((el) => el.classList.remove("preview"));
      }
      function clearActive() {
        document.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
      }
      function highlightRelated(spanIds, planIds, stepId) {
        clearPreview();
        (spanIds || []).forEach((id) => {
          document.querySelectorAll('[data-span-id="' + id + '"]').forEach((el) => el.classList.add("preview"));
        });
        (planIds || []).forEach((id) => {
          document.querySelectorAll('[data-plan-id="' + id + '"]').forEach((el) => el.classList.add("preview"));
        });
        if (stepId) {
          document.querySelectorAll('[data-step-id="' + stepId + '"]').forEach((el) => el.classList.add("preview"));
        }
      }
      function applyActive() {
        clearActive();
        if (selectedSpanId) {
          document.querySelectorAll('[data-span-id="' + selectedSpanId + '"]').forEach((el) => el.classList.add("active"));
        }
        if (selectedPlanId) {
          document.querySelectorAll('[data-plan-id="' + selectedPlanId + '"]').forEach((el) => el.classList.add("active"));
        }
        if (selectedStepId) {
          document.querySelectorAll('[data-step-id="' + selectedStepId + '"]').forEach((el) => el.classList.add("active"));
        }
      }
      function shotCard(label, obs) {
        if (!obs) {
          return '<div class="phase-card"><h3>' + label + '</h3><em class="muted">なし</em></div>';
        }
        return (
          '<div class="phase-card"><h3>' +
          label +
          '</h3><div class="url">' +
          escapeHtml(obs.url || "") +
          "</div>" +
          (obs.screenshot
            ? '<img src="' + escapeHtml(obs.screenshot) + '" alt="' + escapeHtml(label) + ' screenshot" />'
            : "<em>screenshot なし</em>") +
          "</div>"
        );
      }
      function renderObs(stepId) {
        const panel = document.getElementById("obs-panel");
        const step = byId[stepId];
        if (!step) {
          panel.innerHTML = '<p class="muted">Observation がありません。</p>';
          return;
        }
        const before = step.observations.find((o) => o.phase === "before");
        const after =
          step.observations.find((o) => o.phase === "after") ||
          step.observations.find((o) => o.phase === "assertion") ||
          step.observations[step.observations.length - 1];
        let bindChange = "";
        if (step.bindingChange) {
          bindChange =
            '<div class="warn-box"><strong>Binding 変更（レビューシグナル）</strong><div class="meta">' +
            escapeHtml(step.bindingChange.headline) +
            '</div><div class="meta">' +
            escapeHtml(step.bindingChange.reason) +
            '</div><table class="diff-table"><thead><tr><th></th><th>前回</th><th>今回</th></tr></thead><tbody><tr><th>Locator</th><td><code>' +
            escapeHtml(step.bindingChange.previousLabel) +
            '</code></td><td><code>' +
            escapeHtml(step.bindingChange.currentLabel) +
            '</code></td></tr><tr><th>変化</th><td colspan="2"><code>' +
            escapeHtml((step.bindingChange.changedFields || []).join(", ") || "locator") +
            "</code></td></tr></tbody></table></div>";
        }
        let evaluation = "";
        if (step.evaluation) {
          evaluation =
            '<div class="assert-box ' +
            (step.evaluation.passed ? "" : "failed") +
            '"><strong>Assertion</strong> ' +
            (step.evaluation.passed ? "passed" : "failed") +
            '<div class="meta">' +
            escapeHtml(step.evaluation.message) +
            "</div>" +
            (step.evaluation.expected || step.evaluation.actual
              ? '<div class="assert-grid"><span class="k">Expected</span><code>' +
                escapeHtml(step.evaluation.expected) +
                '</code><span class="k">Actual</span><code>' +
                escapeHtml(step.evaluation.actual) +
                "</code></div>"
              : "") +
            "</div>";
        }
        let binding = step.binding
          ? '<div class="meta"><strong>Binding</strong> ' +
            escapeHtml(step.binding.strategy) +
            " · <code>" +
            escapeHtml(step.binding.locatorLabel) +
            "</code><br/>" +
            escapeHtml(step.binding.rationale) +
            "</div>"
          : "";
        panel.innerHTML =
          '<div class="meta"><strong>Status</strong> ' +
          escapeHtml(step.status) +
          '</div><div class="meta"><code>' +
          escapeHtml(step.occurrencePath || step.id) +
          "</code></div>" +
          bindChange +
          binding +
          evaluation +
          (step.errorMessage
            ? '<div class="meta" style="color:#b00020">' + escapeHtml(step.errorMessage) + "</div>"
            : "") +
          '<div class="phase-grid">' +
          shotCard("before", before) +
          shotCard("after", after) +
          "</div>";
      }
      function escapeHtml(s) {
        return String(s)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }
      function selectStep(stepEl) {
        selectedStepId = stepEl.getAttribute("data-step-id");
        selectedPlanId = stepEl.getAttribute("data-plan-id");
        const spanIds = (stepEl.getAttribute("data-span-ids") || "").split(/\\s+/).filter(Boolean);
        selectedSpanId = spanIds[0] || null;
        applyActive();
        highlightRelated(spanIds, selectedPlanId ? [selectedPlanId] : [], selectedStepId);
        renderObs(selectedStepId);
      }
      function bindSpanEl(el) {
        el.addEventListener("mouseenter", () => {
          const planIds = (el.getAttribute("data-plan-ids") || "").split(/\\s+/).filter(Boolean);
          highlightRelated([el.getAttribute("data-span-id")], planIds, null);
        });
        el.addEventListener("mouseleave", () => {
          clearPreview();
          applyActive();
        });
        el.addEventListener("click", () => {
          selectedSpanId = el.getAttribute("data-span-id");
          const planIds = (el.getAttribute("data-plan-ids") || "").split(/\\s+/).filter(Boolean);
          selectedPlanId = planIds[0] || null;
          const firstExec = selectedPlanId
            ? document.querySelector('.exec-step[data-plan-id="' + selectedPlanId + '"]')
            : null;
          selectedStepId = firstExec ? firstExec.getAttribute("data-step-id") : null;
          applyActive();
          highlightRelated([selectedSpanId], planIds, selectedStepId);
          if (selectedStepId) renderObs(selectedStepId);
          else {
            document.getElementById("obs-panel").innerHTML =
              '<p class="muted">この Source に対応する実行 Step はありません（未マッピング等）。</p>';
          }
        });
      }
      document.querySelectorAll(".src-span").forEach(bindSpanEl);
      document.querySelectorAll(".src-inline").forEach(bindSpanEl);
      document.querySelectorAll(".plan-node").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          const spanIds = (el.getAttribute("data-span-ids") || "").split(/\\s+/).filter(Boolean);
          highlightRelated(spanIds, [el.getAttribute("data-plan-id")], null);
        });
        el.addEventListener("mouseleave", () => {
          clearPreview();
          applyActive();
        });
        el.addEventListener("click", (ev) => {
          if (ev.target.closest(".exec-step")) return;
          const spanIds = (el.getAttribute("data-span-ids") || "").split(/\\s+/).filter(Boolean);
          selectedPlanId = el.getAttribute("data-plan-id");
          selectedSpanId = spanIds[0] || null;
          const firstExec = document.querySelector('.exec-step[data-plan-id="' + selectedPlanId + '"]');
          selectedStepId = firstExec ? firstExec.getAttribute("data-step-id") : null;
          applyActive();
          highlightRelated(spanIds, [selectedPlanId], selectedStepId);
          if (selectedStepId) renderObs(selectedStepId);
          else {
            document.getElementById("obs-panel").innerHTML =
              '<p class="muted">この Plan に実行 occurrence はありません。</p>';
          }
        });
      });
      document.querySelectorAll(".exec-step").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          const spanIds = (el.getAttribute("data-span-ids") || "").split(/\\s+/).filter(Boolean);
          highlightRelated(spanIds, [el.getAttribute("data-plan-id")], el.getAttribute("data-step-id"));
        });
        el.addEventListener("mouseleave", () => {
          clearPreview();
          applyActive();
        });
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          selectStep(el);
        });
      });
      const firstChanged = document.querySelector(".exec-step.binding-changed");
      const first = firstChanged || document.querySelector(".exec-step");
      if (first) selectStep(first);
    })();
  </script>
</body>
</html>`;

  await writeFile(outputPath, html, "utf8");
  return outputPath;
}
