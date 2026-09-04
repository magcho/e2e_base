import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioResult, StepResult } from "@e2e-base/core";
import {
  listUnexecutedPlanNodeIds,
  listUnmappedPlanNodeIds,
  listUnmappedSourceSpanIds,
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

export type RenderReviewReportOptions = {
  bundle: ReviewBundle;
  outputPath: string;
  playbookPath?: string;
};

/**
 * 3 カラム Review Viewer。
 * 左: Source / 中: Plan+Execution / 右: Observation
 */
export async function writeReviewHtmlReport(options: RenderReviewReportOptions): Promise<string> {
  const { bundle, outputPath, playbookPath } = options;
  const reportDir = path.dirname(outputPath);
  await mkdir(reportDir, { recursive: true });

  const { sourceDocument, sourceSpans, links, planNodes, result } = bundle;
  const unmappedSpans = new Set(listUnmappedSourceSpanIds(sourceSpans, links));
  const unmappedPlans = new Set(listUnmappedPlanNodeIds(planNodes, links));
  const unexecutedPlans = new Set(listUnexecutedPlanNodeIds(planNodes, result.steps));

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

  const sourceBlocks = sourceSpans
    .map((span) => {
      const text = sourceDocument.content.slice(span.start, span.end);
      const plans = (spanToPlans.get(span.id) ?? []).join(" ");
      const flags = [unmappedSpans.has(span.id) ? "unmapped" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="src-span ${flags}" data-span-id="${escapeHtml(span.id)}" data-plan-ids="${escapeHtml(plans)}" title="${escapeHtml(span.label ?? span.id)}">
  <span class="span-label">${escapeHtml(span.label ?? span.id)}${unmappedSpans.has(span.id) ? ' <em class="flag">未マッピング</em>' : ""}</span>
  <span class="span-text">${escapeHtml(text)}</span>
</button>`;
    })
    .join("\n");

  const planBlocks = planNodes
    .map((plan) => {
      const spans = (planToSpans.get(plan.id) ?? []).join(" ");
      const execs = result.steps.filter((s) => s.planNodeId === plan.id);
      const flags = [
        unmappedPlans.has(plan.id) ? "unmapped" : "",
        unexecutedPlans.has(plan.id) ? "unexecuted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const execHtml =
        execs.length === 0
          ? `<div class="exec-empty">実行 occurrence なし</div>`
          : execs
              .map((ex) => {
                const bindChange = ex.bindingChange
                  ? `<div class="bind-change" title="${escapeHtml(ex.bindingChange.reason)}">⚠ Binding 変更</div>`
                  : "";
                return `<button type="button" class="exec-step ${ex.bindingChange ? "binding-changed" : ""}" data-step-id="${escapeHtml(ex.id)}" data-plan-id="${escapeHtml(plan.id)}" data-span-ids="${escapeHtml(spans)}" data-occ="${escapeHtml(ex.occurrencePath ?? "")}">
  ${statusBadge(ex.status)} <code>${escapeHtml(ex.occurrencePath ?? ex.stepId)}</code>
  ${bindChange}
</button>`;
              })
              .join("");
      return `<div class="plan-node ${flags}" data-plan-id="${escapeHtml(plan.id)}" data-span-ids="${escapeHtml(spans)}">
  <div class="plan-head">
    <strong>${escapeHtml(plan.label)}</strong>
    ${unmappedPlans.has(plan.id) ? '<em class="flag">未マッピング</em>' : ""}
    ${unexecutedPlans.has(plan.id) ? '<em class="flag">未実行</em>' : ""}
  </div>
  <div class="exec-list">${execHtml}</div>
</div>`;
    })
    .join("\n");

  const observationPayload = result.steps.map((step) => {
    const obs = (step.observations ?? (step.observation ? [step.observation] : [])).map((o) => ({
      phase: o.phase ?? "after",
      url: o.url ?? "",
      screenshot: relShot(reportDir, o.screenshotPath) ?? "",
      text: o.visibleTextSample ?? "",
    }));
    return {
      id: step.id,
      planNodeId: step.planNodeId ?? "",
      status: step.status,
      occurrencePath: step.occurrencePath ?? "",
      binding: step.binding
        ? {
            strategy: step.binding.strategy,
            locator: step.binding.locator,
            rationale: step.binding.rationale,
          }
        : null,
      bindingChange: step.bindingChange
        ? {
            reason: step.bindingChange.reason,
            previous: step.bindingChange.previous.locator,
            current: step.bindingChange.current.locator,
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
      --panel: rgba(255,255,255,0.82);
      --hl: #ffe6a8;
      --hl-strong: #ffd36b;
      --warn: #9a5b00;
      --warn-bg: #fff3d6;
      --flag: #8a2f2f;
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
      background: rgba(255,255,255,0.7);
      backdrop-filter: blur(6px);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    header.app h1 {
      margin: 0 0 0.35rem;
      font-size: 1.25rem;
      font-family: "IBM Plex Serif", "Source Han Serif", serif;
    }
    header.app p { margin: 0.15rem 0; color: var(--muted); font-size: 0.9rem; }
    .badge { color: #fff; padding: 0.12rem 0.45rem; border-radius: 4px; font-size: 0.75rem; }
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(280px, 1.2fr) minmax(260px, 1fr);
      gap: 0;
      min-height: calc(100vh - 110px);
    }
    .col {
      border-right: 1px solid var(--line);
      padding: 0.85rem;
      overflow: auto;
      max-height: calc(100vh - 110px);
    }
    .col:last-child { border-right: 0; }
    .col h2 {
      margin: 0 0 0.75rem;
      font-size: 0.8rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
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
    .flag { color: var(--flag); font-style: normal; font-size: 0.75rem; margin-left: 0.35rem; }
    .src-span.unmapped, .plan-node.unmapped { border-style: dashed; }
    .plan-node.unexecuted { opacity: 0.72; }
    .plan-head { margin-bottom: 0.35rem; }
    .exec-list { display: flex; flex-direction: column; gap: 0.35rem; }
    .exec-step { margin: 0; }
    .exec-step.binding-changed { border-color: #d4a017; background: var(--warn-bg); }
    .bind-change { color: var(--warn); font-size: 0.8rem; margin-top: 0.25rem; font-weight: 600; }
    .exec-empty { font-size: 0.85rem; color: var(--muted); }
    #obs-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.75rem;
      min-height: 12rem;
    }
    #obs-panel .muted { color: var(--muted); }
    .phase-tabs { display: flex; gap: 0.35rem; margin: 0.5rem 0; flex-wrap: wrap; }
    .phase-tabs button {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 4px;
      padding: 0.25rem 0.55rem;
      cursor: pointer;
      font: inherit;
    }
    .phase-tabs button.active { background: var(--hl-strong); border-color: #c7921a; }
    .shot img { max-width: 100%; border: 1px solid var(--line); margin-top: 0.5rem; }
    .meta { font-size: 0.88rem; line-height: 1.45; margin: 0.35rem 0; }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.8em; }
    .warn-box {
      background: var(--warn-bg);
      border: 1px solid #e0b84e;
      color: var(--warn);
      padding: 0.5rem 0.65rem;
      border-radius: 6px;
      margin: 0.5rem 0;
      font-size: 0.88rem;
    }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
      .col { max-height: none; border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <header class="app">
    <h1>Review Viewer（Source / Plan / Observation）</h1>
    <p>Scenario: <strong>${escapeHtml(result.scenarioName)}</strong> ${statusBadge(result.status)}
      ${bundle.runLabel ? `· Run: <code>${escapeHtml(bundle.runLabel)}</code>` : ""}</p>
    <p>ID: <code>${escapeHtml(result.scenarioId)}</code>
      ${playbookPath ? `· Playbook: <code>${escapeHtml(playbookPath)}</code>` : ""}</p>
    <p>Span または Step をホバーでプレビュー、クリックで選択固定。Binding 変更は停止せずレビューシグナルとして表示。</p>
  </header>
  <div class="layout">
    <section class="col" id="col-source">
      <h2>Source</h2>
      <p class="meta">${escapeHtml(sourceDocument.label ?? sourceDocument.id)} · ${escapeHtml(sourceDocument.kind)}</p>
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
      let phase = "before";

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
      function renderObs(stepId) {
        const panel = document.getElementById("obs-panel");
        const step = byId[stepId];
        if (!step) {
          panel.innerHTML = '<p class="muted">Observation がありません。</p>';
          return;
        }
        const phases = step.observations.map((o) => o.phase);
        if (!phases.includes(phase)) {
          phase = phases[0] || "after";
        }
        const current = step.observations.find((o) => o.phase === phase) || step.observations[0];
        const tabs = phases
          .map(
            (p) =>
              '<button type="button" data-phase="' +
              p +
              '" class="' +
              (p === phase ? "active" : "") +
              '">' +
              p +
              "</button>",
          )
          .join("");
        let bindChange = "";
        if (step.bindingChange) {
          bindChange =
            '<div class="warn-box"><strong>Binding 変更（レビューシグナル）</strong><br/>' +
            escapeHtml(step.bindingChange.reason) +
            "<br/><code>prev: " +
            escapeHtml(JSON.stringify(step.bindingChange.previous)) +
            "</code><br/><code>curr: " +
            escapeHtml(JSON.stringify(step.bindingChange.current)) +
            "</code></div>";
        }
        let evaluation = "";
        if (step.evaluation) {
          evaluation =
            '<div class="meta"><strong>Assertion</strong> ' +
            (step.evaluation.passed ? "passed" : "failed") +
            ": " +
            escapeHtml(step.evaluation.message) +
            (step.evaluation.expected
              ? "<br/>Expected: <code>" +
                escapeHtml(step.evaluation.expected) +
                "</code> / Actual: <code>" +
                escapeHtml(step.evaluation.actual) +
                "</code>"
              : "") +
            "</div>";
        }
        let binding = step.binding
          ? '<div class="meta"><strong>Binding</strong> ' +
            escapeHtml(step.binding.strategy) +
            " · <code>" +
            escapeHtml(JSON.stringify(step.binding.locator)) +
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
          '<div class="phase-tabs">' +
          tabs +
          "</div>" +
          (current
            ? '<div class="meta">URL: ' +
              escapeHtml(current.url || "") +
              '</div><div class="shot">' +
              (current.screenshot
                ? '<img src="' + escapeHtml(current.screenshot) + '" alt="' + escapeHtml(phase) + ' screenshot" />'
                : "<em>screenshot なし</em>") +
              "</div>"
            : '<p class="muted">この Step に Observation はありません（skipped 等）。</p>');
        panel.querySelectorAll("[data-phase]").forEach((btn) => {
          btn.addEventListener("click", () => {
            phase = btn.getAttribute("data-phase");
            renderObs(stepId);
          });
        });
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
      document.querySelectorAll(".src-span").forEach((el) => {
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
        });
      });
      document.querySelectorAll(".plan-node").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          const spanIds = (el.getAttribute("data-span-ids") || "").split(/\\s+/).filter(Boolean);
          highlightRelated(spanIds, [el.getAttribute("data-plan-id")], null);
        });
        el.addEventListener("mouseleave", () => {
          clearPreview();
          applyActive();
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
        el.addEventListener("click", () => selectStep(el));
      });
      const first = document.querySelector(".exec-step");
      if (first) selectStep(first);
    })();
  </script>
</body>
</html>`;

  await writeFile(outputPath, html, "utf8");
  return outputPath;
}
