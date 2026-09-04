import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
  compareRuns?: CompareRunLink[];
};

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
    html += `<button type="button" class="intent-span ${unmapped ? "missing" : ""}" data-span-id="${escapeHtml(span.id)}" data-plan-ids="${escapeHtml(plans)}" data-label="${escapeHtml(span.label ?? span.id)}"><span class="intent-status" data-status-for="${escapeHtml(span.id)}"></span><span class="intent-text">${escapeHtml(text)}</span></button>`;
    cursor = span.end;
  }
  if (cursor < content.length) {
    html += escapeHtml(content.slice(cursor));
  }
  return html;
}

/**
 * 判断作業向け 3 カラム Review 画面。
 * 動詞: 選ぶ → 照合する → 判断する → 完了する
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
  const bindingChangeCount = result.steps.filter((s) => s.bindingChange).length;
  const attention = summarizeReviewAttention({
    scenarioStatus: result.status,
    bindingChangeCount,
    unmappedSpanCount: unmappedSpanIds.length,
    unmappedPlanCount: unmappedPlanIds.length,
    unexecutedPlanCount: unexecutedPlanIds.length,
  });
  const reviewMode = bundle.reviewMode ?? "qualification";
  const modeHint =
    reviewMode === "verification"
      ? "再実行 Verification：前回確認した意味と振る舞いが維持されているかを、差分のある検査意図から確認します。"
      : "初回 Qualification：この解釈を今後の基準にしてよいかを、すべての検査意図を順に確認します。";

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

  const stepsPayload = result.steps.map((step) => {
    const obs = (step.observations ?? (step.observation ? [step.observation] : [])).map((o) => ({
      phase: o.phase ?? "after",
      url: o.url ?? "",
      screenshot: relShot(reportDir, o.screenshotPath) ?? "",
    }));
    const change = step.bindingChange ? describeBindingChange(step.bindingChange) : null;
    const actionLabel =
      (step.occurrencePath && bundle.actionLabels?.[step.occurrencePath]) ||
      step.occurrencePath ||
      step.stepId;
    return {
      id: step.id,
      planNodeId: step.planNodeId ?? "",
      status: step.status,
      occurrencePath: step.occurrencePath ?? "",
      actionLabel,
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
            previousRationale: step.bindingChange.previous.rationale,
            currentRationale: step.bindingChange.current.rationale,
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

  const planPayload = planNodes.map((plan) => ({
    id: plan.id,
    label: plan.label,
    spanIds: planToSpans.get(plan.id) ?? [],
    unmapped: unmappedPlanIds.includes(plan.id),
    unexecuted: unexecutedPlanIds.includes(plan.id),
    stepIds: result.steps.filter((s) => s.planNodeId === plan.id).map((s) => s.id),
  }));

  const spanPayload = sourceSpans.map((span) => ({
    id: span.id,
    label: span.label ?? span.id,
    planIds: spanToPlans.get(span.id) ?? [],
    missing: unmappedSpans.has(span.id),
  }));

  const storageKey = `e2e-review:${result.scenarioId}:${bundle.runLabel ?? "default"}`;

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>Review — ${escapeHtml(result.scenarioName)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #15202b;
      --muted: #5b6b7c;
      --line: #cfd8e3;
      --panel: #ffffff;
      --select: #1f6feb;
      --select-soft: #e8f1ff;
      --warn: #c47a00;
      --warn-soft: #fff4df;
      --danger: #b42318;
      --danger-soft: #fdeceb;
      --ok: #067647;
      --ok-soft: #e8f7ef;
      font-family: "IBM Plex Sans", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: #eef2f6;
      min-height: 100vh;
    }
    header.app {
      padding: 0.9rem 1.1rem 0.75rem;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,0.94);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .question {
      margin: 0 0 0.55rem;
      font-size: 1.05rem;
      font-weight: 650;
      font-family: "IBM Plex Serif", "Source Han Serif", serif;
      line-height: 1.35;
    }
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin: 0.35rem 0;
    }
    .pill {
      display: inline-flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 7.5rem;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      padding: 0.35rem 0.55rem;
    }
    .pill .k { font-size: 0.68rem; letter-spacing: 0.03em; text-transform: uppercase; color: var(--muted); }
    .pill .v { font-size: 0.9rem; font-weight: 600; }
    .pill.warn { border-color: #efc57a; background: var(--warn-soft); }
    .pill.danger { border-color: #f0b4ae; background: var(--danger-soft); }
    .pill.ok { border-color: #9ed0b3; background: var(--ok-soft); }
    .mode-hint, .meta-line { margin: 0.25rem 0; color: var(--muted); font-size: 0.82rem; }
    .compare-runs { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem; }
    .run-chip {
      display: inline-block;
      padding: 0.18rem 0.55rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 0.78rem;
      text-decoration: none;
      color: var(--ink);
      background: #fff;
    }
    .run-chip.active { border-color: var(--select); background: var(--select-soft); color: var(--select); font-weight: 650; }
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 0.25fr) minmax(260px, 0.3fr) minmax(320px, 0.45fr);
      min-height: calc(100vh - 150px);
    }
    .col {
      border-right: 1px solid var(--line);
      padding: 0.85rem;
      overflow: auto;
      max-height: calc(100vh - 150px);
      background: #f7f9fb;
    }
    .col:last-child { border-right: 0; background: #f3f6f9; }
    .col h2 {
      margin: 0 0 0.55rem;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .source-doc {
      white-space: pre-wrap;
      line-height: 1.7;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.85rem;
      font-size: 0.95rem;
    }
    .intent-span {
      display: inline;
      margin: 0;
      padding: 0.05rem 0.12rem;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      font: inherit;
      color: inherit;
      text-align: left;
    }
    .intent-span.related { background: var(--select-soft); }
    .intent-span.selected {
      border-color: var(--select);
      box-shadow: 0 0 0 2px rgba(31,111,235,0.18);
      background: #dceaff;
    }
    .intent-span.missing .intent-text { color: var(--danger); text-decoration: underline wavy var(--danger); }
    .intent-status {
      display: inline-block;
      min-width: 2.8rem;
      margin-right: 0.25rem;
      font-size: 0.68rem;
      font-weight: 700;
      vertical-align: middle;
      border-radius: 999px;
      padding: 0.05rem 0.35rem;
      background: #eef2f6;
      color: var(--muted);
    }
    .intent-status.confirmed { background: var(--ok-soft); color: var(--ok); }
    .intent-status.reviewing { background: var(--select-soft); color: var(--select); }
    .intent-status.pending { background: #eef2f6; color: var(--muted); }
    .intent-status.missing { background: var(--danger-soft); color: var(--danger); }
    .ops-panel, .obs-panel, .judge-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.75rem;
    }
    .ops-panel { min-height: 12rem; }
    .ops-title { margin: 0 0 0.65rem; font-size: 1rem; font-weight: 650; }
    .op-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .op-item {
      display: grid;
      grid-template-columns: 1.4rem 1fr auto;
      gap: 0.45rem;
      align-items: start;
      width: 100%;
      text-align: left;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      padding: 0.55rem 0.6rem;
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    .op-item.selected {
      border-color: var(--select);
      box-shadow: 0 0 0 2px rgba(31,111,235,0.15);
      background: var(--select-soft);
    }
    .op-item.related { background: #f5f9ff; }
    .op-item.dimmed { opacity: 0.35; }
    .op-num { color: var(--muted); font-size: 0.8rem; }
    .op-label { font-size: 0.92rem; line-height: 1.35; }
    .op-status { font-size: 0.75rem; font-weight: 700; }
    .op-status.ok { color: var(--ok); }
    .op-status.bad { color: var(--danger); }
    .op-status.skip { color: var(--muted); }
    .attn {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      margin-top: 0.25rem;
      color: var(--warn);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .attn-details {
      margin-top: 0.45rem;
      border: 1px solid #efc57a;
      background: var(--warn-soft);
      border-radius: 8px;
      padding: 0.55rem 0.65rem;
      font-size: 0.82rem;
    }
    .attn-details[hidden] { display: none; }
    .dim-note { color: var(--muted); font-size: 0.8rem; margin: 0.4rem 0 0; }
    .empty { color: var(--muted); font-size: 0.9rem; }
    .obs-panel { min-height: 18rem; }
    .phase-tabs { display: flex; gap: 0.35rem; margin: 0.4rem 0 0.65rem; }
    .phase-tabs button {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 6px;
      padding: 0.28rem 0.6rem;
      cursor: pointer;
      font: inherit;
    }
    .phase-tabs button.active { border-color: var(--select); background: var(--select-soft); color: var(--select); font-weight: 650; }
    .shot-frame {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
      min-height: 16rem;
    }
    .shot-frame img {
      display: block;
      width: 100%;
      max-height: 58vh;
      object-fit: contain;
      background: #fafbfc;
      cursor: zoom-in;
    }
    .shot-frame.zoomed img { max-height: none; cursor: zoom-out; }
    .shot-url { margin-top: 0.35rem; color: var(--muted); font-size: 0.75rem; word-break: break-all; }
    .assert-box {
      margin: 0.55rem 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.55rem 0.65rem;
      background: #f8fafc;
    }
    .assert-box.failed { border-color: #f0b4ae; background: var(--danger-soft); }
    .assert-grid {
      display: grid;
      grid-template-columns: 5rem 1fr;
      gap: 0.25rem 0.45rem;
      margin-top: 0.35rem;
      font-size: 0.86rem;
    }
    .assert-grid .k { color: var(--muted); }
    .judge-panel { margin-top: 0.75rem; }
    .judge-panel h3 { margin: 0 0 0.45rem; font-size: 0.9rem; }
    .judge-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .judge-actions button, .complete-btn {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      padding: 0.4rem 0.7rem;
      cursor: pointer;
      font: inherit;
    }
    .judge-actions button.active-as { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); font-weight: 700; }
    .judge-actions button.active-fix { border-color: var(--danger); background: var(--danger-soft); color: var(--danger); font-weight: 700; }
    .judge-actions button.active-defer { border-color: #9aa7b5; background: #eef2f6; font-weight: 700; }
    .complete-btn {
      margin-top: 0.55rem;
      width: 100%;
      background: var(--select);
      border-color: var(--select);
      color: #fff;
      font-weight: 700;
    }
    .complete-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .comment-box {
      width: 100%;
      margin-top: 0.45rem;
      min-height: 2.6rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.45rem 0.55rem;
      font: inherit;
      resize: vertical;
    }
    details.tech {
      margin-top: 0.55rem;
      color: var(--muted);
      font-size: 0.78rem;
    }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.84em; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .col { max-height: none; border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <header class="app">
    <p class="question">この検査意図は、想定した操作として実行され、期待した結果になったか？</p>
    <div class="status-row">
      <div class="pill ${result.status === "passed" ? "ok" : "danger"}">
        <span class="k">実行結果</span>
        <span class="v">${escapeHtml(attention.executionLabel)}</span>
      </div>
      <div class="pill" id="progress-pill">
        <span class="k">レビュー進捗</span>
        <span class="v" id="progress-value">0 / ${sourceSpans.length}項目を確認済み</span>
      </div>
      <div class="pill" id="judgment-pill">
        <span class="k">レビュー判断</span>
        <span class="v" id="judgment-value">未完了</span>
      </div>
      <div class="pill ${attention.needsReview ? "warn" : "ok"}">
        <span class="k">注意シグナル</span>
        <span class="v">${escapeHtml(attention.reviewLabel)}</span>
      </div>
    </div>
    <p class="mode-hint">${escapeHtml(modeHint)}</p>
    <p class="meta-line">Scenario: <strong>${escapeHtml(result.scenarioName)}</strong>
      ${bundle.runLabel ? ` · Run: <code>${escapeHtml(bundle.runLabel)}</code>` : ""}
      ${playbookPath ? ` · <code>${escapeHtml(playbookPath)}</code>` : ""}</p>
    ${compareNav}
  </header>
  <div class="layout">
    <section class="col" id="col-intent">
      <h2>検査したかったこと</h2>
      <div class="source-doc">${inlineSource}</div>
      <div class="judge-panel">
        <h3>この検査意図の判断</h3>
        <div class="judge-actions">
          <button type="button" data-verdict="as_intended">意図どおり</button>
          <button type="button" data-verdict="needs_fix">要修正</button>
          <button type="button" data-verdict="deferred">判断保留</button>
        </div>
        <textarea class="comment-box" id="comment-box" placeholder="コメント（任意）"></textarea>
        <button type="button" class="complete-btn" id="complete-btn" disabled>この実行をレビュー済みにする</button>
        <p class="dim-note" id="complete-hint">すべての検査意図を判断すると完了できます。</p>
      </div>
    </section>
    <section class="col" id="col-ops">
      <h2>実際に行った操作</h2>
      <div class="ops-panel" id="ops-panel"><p class="empty">検査意図を選ぶと、対応する操作だけを表示します。</p></div>
    </section>
    <section class="col" id="col-obs">
      <h2>ブラウザで起きたこと</h2>
      <div class="obs-panel" id="obs-panel"><p class="empty">操作を選ぶと、証拠となる画面状態を大きく表示します。</p></div>
    </section>
  </div>
  <script type="application/json" id="review-data">${JSON.stringify({
    storageKey,
    spans: spanPayload,
    plans: planPayload,
    steps: stepsPayload,
  }).replaceAll("<", "\\u003c")}</script>
  <script>
    (function () {
      const data = JSON.parse(document.getElementById("review-data").textContent);
      const stepsById = Object.fromEntries(data.steps.map((s) => [s.id, s]));
      const spansById = Object.fromEntries(data.spans.map((s) => [s.id, s]));
      let selectedSpanId = null;
      let selectedStepId = null;
      let phase = "after";
      let state = loadState();

      function loadState() {
        try {
          const raw = localStorage.getItem(data.storageKey);
          if (!raw) return { decisions: {}, scenarioCompleted: false };
          const parsed = JSON.parse(raw);
          return {
            decisions: parsed.decisions || {},
            scenarioCompleted: !!parsed.scenarioCompleted,
          };
        } catch {
          return { decisions: {}, scenarioCompleted: false };
        }
      }
      function saveState() {
        localStorage.setItem(
          data.storageKey,
          JSON.stringify({
            decisions: state.decisions,
            scenarioCompleted: state.scenarioCompleted,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      function escapeHtml(s) {
        return String(s)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }
      function statusLabel(kind) {
        if (kind === "confirmed") return "確認済み";
        if (kind === "reviewing") return "確認中";
        if (kind === "missing") return "欠落";
        return "未確認";
      }
      function classifySpan(span) {
        if (span.missing) return "missing";
        if (state.decisions[span.id] && state.decisions[span.id].verdict) return "confirmed";
        if (selectedSpanId === span.id) return "reviewing";
        return "pending";
      }
      function refreshHeader() {
        const total = data.spans.length;
        const decided = data.spans.filter((s) => state.decisions[s.id] && state.decisions[s.id].verdict).length;
        const allDecided = decided === total && total > 0;
        document.getElementById("progress-value").textContent =
          decided + " / " + total + "項目を確認済み";
        const judgment = allDecided && state.scenarioCompleted ? "レビュー済み" : "未完了";
        document.getElementById("judgment-value").textContent = judgment;
        const jp = document.getElementById("judgment-pill");
        jp.classList.toggle("ok", judgment === "レビュー済み");
        const btn = document.getElementById("complete-btn");
        btn.disabled = !allDecided || state.scenarioCompleted;
        document.getElementById("complete-hint").textContent = state.scenarioCompleted
          ? "この実行はレビュー済みです。"
          : allDecided
            ? "判断が揃いました。レビュー済みにできます。"
            : "すべての検査意図を判断すると完了できます。";
      }
      function refreshIntentStatuses() {
        data.spans.forEach((span) => {
          const kind = classifySpan(span);
          document.querySelectorAll('[data-status-for="' + span.id + '"]').forEach((el) => {
            el.className = "intent-status " + kind;
            el.textContent = statusLabel(kind);
          });
          document.querySelectorAll('.intent-span[data-span-id="' + span.id + '"]').forEach((el) => {
            el.classList.toggle("selected", selectedSpanId === span.id);
            el.classList.toggle("related", selectedSpanId === span.id);
          });
        });
        const decision = selectedSpanId ? state.decisions[selectedSpanId] : null;
        document.querySelectorAll("[data-verdict]").forEach((btn) => {
          const v = btn.getAttribute("data-verdict");
          btn.classList.toggle("active-as", decision && decision.verdict === "as_intended" && v === "as_intended");
          btn.classList.toggle("active-fix", decision && decision.verdict === "needs_fix" && v === "needs_fix");
          btn.classList.toggle("active-defer", decision && decision.verdict === "deferred" && v === "deferred");
        });
        document.getElementById("comment-box").value = (decision && decision.comment) || "";
        refreshHeader();
      }
      function relatedStepIds(spanId) {
        const span = spansById[spanId];
        if (!span) return [];
        const planSet = new Set(span.planIds);
        return data.steps.filter((s) => planSet.has(s.planNodeId)).map((s) => s.id);
      }
      function renderOps() {
        const panel = document.getElementById("ops-panel");
        if (!selectedSpanId) {
          panel.innerHTML = '<p class="empty">検査意図を選ぶと、対応する操作だけを表示します。</p>';
          return;
        }
        const span = spansById[selectedSpanId];
        const related = relatedStepIds(selectedSpanId);
        if (span.missing) {
          panel.innerHTML =
            '<h3 class="ops-title">' +
            escapeHtml(span.label) +
            '</h3><p class="empty">この検査意図に対応する操作がありません（欠落）。意図が Plan に落ちていない可能性があります。</p>';
          return;
        }
        if (related.length === 0) {
          panel.innerHTML =
            '<h3 class="ops-title">' +
            escapeHtml(span.label) +
            '</h3><p class="empty">対応する実行はありません。</p>';
          return;
        }
        const items = related
          .map((id, i) => {
            const step = stepsById[id];
            const selected = selectedStepId === id;
            const st =
              step.status === "passed"
                ? '<span class="op-status ok">成功</span>'
                : step.status === "failed" || step.status === "error"
                  ? '<span class="op-status bad">失敗</span>'
                  : '<span class="op-status skip">未実行</span>';
            const attn = step.bindingChange
              ? '<div class="attn">⚠ 注意：前回とは異なる方法で対象を特定</div>'
              : "";
            return (
              '<button type="button" class="op-item' +
              (selected ? " selected" : " related") +
              '" data-step-id="' +
              escapeHtml(id) +
              '"><span class="op-num">' +
              (i + 1) +
              '.</span><span class="op-label">' +
              escapeHtml(step.actionLabel) +
              attn +
              "</span>" +
              st +
              "</button>"
            );
          })
          .join("");
        panel.innerHTML =
          '<h3 class="ops-title">' +
          escapeHtml(span.label) +
          '</h3><div class="op-list">' +
          items +
          '</div><p class="dim-note">関係しない操作は畳んでいます。詳細 ID は証拠側で確認できます。</p>';
        panel.querySelectorAll(".op-item").forEach((el) => {
          el.addEventListener("click", () => {
            selectedStepId = el.getAttribute("data-step-id");
            renderOps();
            renderObs();
          });
        });
      }
      function renderObs() {
        const panel = document.getElementById("obs-panel");
        if (!selectedStepId) {
          panel.innerHTML = '<p class="empty">操作を選ぶと、証拠となる画面状態を大きく表示します。</p>';
          return;
        }
        const step = stepsById[selectedStepId];
        const before = step.observations.find((o) => o.phase === "before");
        const after =
          step.observations.find((o) => o.phase === "after") ||
          step.observations.find((o) => o.phase === "assertion") ||
          step.observations[step.observations.length - 1];
        const current = phase === "before" ? before : after;
        const tabs =
          '<div class="phase-tabs">' +
          '<button type="button" data-phase="before" class="' +
          (phase === "before" ? "active" : "") +
          '">Before</button>' +
          '<button type="button" data-phase="after" class="' +
          (phase === "after" ? "active" : "") +
          '">After / Changes</button></div>';
        let assertHtml = "";
        if (step.evaluation) {
          assertHtml =
            '<div class="assert-box ' +
            (step.evaluation.passed ? "" : "failed") +
            '"><strong>Assertion</strong> ' +
            (step.evaluation.passed ? "成功" : "失敗") +
            "<div>" +
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
        let attnHtml = "";
        if (step.bindingChange) {
          attnHtml =
            '<button type="button" class="attn" id="attn-toggle">⚠ 注意：前回とは異なる方法で対象を特定しました（詳細）</button>' +
            '<div class="attn-details" id="attn-details" hidden>' +
            "<div>" +
            escapeHtml(step.bindingChange.reason) +
            "</div>" +
            "<div style='margin-top:0.35rem'><strong>前回 Locator</strong><br/><code>" +
            escapeHtml(step.bindingChange.previousLabel) +
            "</code></div>" +
            "<div style='margin-top:0.35rem'><strong>今回 Locator</strong><br/><code>" +
            escapeHtml(step.bindingChange.currentLabel) +
            "</code></div>" +
            "<div style='margin-top:0.35rem'><strong>前回の一致理由</strong><br/>" +
            escapeHtml(step.bindingChange.previousRationale || "") +
            "</div>" +
            "<div style='margin-top:0.35rem'><strong>今回の一致理由</strong><br/>" +
            escapeHtml(step.bindingChange.currentRationale || "") +
            "</div>" +
            "<div style='margin-top:0.35rem;color:#5b6b7c'>要素サムネイル比較は今後の拡張です。いまは Locator と一致理由で「同じ意味の要素か」を判断してください。</div>" +
            "</div>";
        }
        const shot =
          current && current.screenshot
            ? '<div class="shot-frame" id="shot-frame"><img src="' +
              escapeHtml(current.screenshot) +
              '" alt="evidence screenshot" /></div><div class="shot-url">' +
              escapeHtml(current.url || "") +
              "</div>"
            : '<p class="empty">screenshot なし</p>';
        panel.innerHTML =
          "<div><strong>" +
          escapeHtml(step.actionLabel) +
          "</strong></div>" +
          tabs +
          assertHtml +
          attnHtml +
          shot +
          '<details class="tech"><summary>内部詳細</summary><div>occurrence: <code>' +
          escapeHtml(step.occurrencePath || step.id) +
          "</code></div>" +
          (step.binding
            ? "<div>Binding: <code>" +
              escapeHtml(step.binding.locatorLabel) +
              "</code><br/>" +
              escapeHtml(step.binding.rationale) +
              "</div>"
            : "") +
          "</details>";
        panel.querySelectorAll("[data-phase]").forEach((btn) => {
          btn.addEventListener("click", () => {
            phase = btn.getAttribute("data-phase");
            renderObs();
          });
        });
        const toggle = document.getElementById("attn-toggle");
        const details = document.getElementById("attn-details");
        if (toggle && details) {
          toggle.addEventListener("click", () => {
            details.hidden = !details.hidden;
          });
        }
        const frame = document.getElementById("shot-frame");
        if (frame) {
          frame.addEventListener("click", () => frame.classList.toggle("zoomed"));
        }
      }
      function selectSpan(spanId) {
        selectedSpanId = spanId;
        const related = relatedStepIds(spanId);
        selectedStepId = related[0] || null;
        const step = selectedStepId ? stepsById[selectedStepId] : null;
        phase = step && step.observations.some((o) => o.phase === "after") ? "after" : "before";
        refreshIntentStatuses();
        renderOps();
        renderObs();
      }
      document.querySelectorAll(".intent-span").forEach((el) => {
        el.addEventListener("click", () => selectSpan(el.getAttribute("data-span-id")));
      });
      document.querySelectorAll("[data-verdict]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!selectedSpanId) return;
          const span = spansById[selectedSpanId];
          if (!span) return;
          state.decisions[selectedSpanId] = {
            spanId: selectedSpanId,
            verdict: btn.getAttribute("data-verdict"),
            comment: document.getElementById("comment-box").value || "",
            decidedAt: new Date().toISOString(),
          };
          state.scenarioCompleted = false;
          saveState();
          refreshIntentStatuses();
          const next = data.spans.find(
            (s) => !(state.decisions[s.id] && state.decisions[s.id].verdict),
          );
          if (next) selectSpan(next.id);
        });
      });
      document.getElementById("comment-box").addEventListener("change", () => {
        if (!selectedSpanId || !state.decisions[selectedSpanId]) return;
        state.decisions[selectedSpanId].comment = document.getElementById("comment-box").value || "";
        saveState();
      });
      document.getElementById("complete-btn").addEventListener("click", () => {
        state.scenarioCompleted = true;
        saveState();
        refreshIntentStatuses();
      });
      const first =
        data.spans.find((s) => !s.missing) ||
        data.spans[0];
      if (first) selectSpan(first.id);
      else refreshIntentStatuses();
    })();
  </script>
</body>
</html>`;

  await writeFile(outputPath, html, "utf8");
  return outputPath;
}
