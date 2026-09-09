import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioResult, StepResult } from "@e2e-base/core";

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

export {
  writeReviewHtmlReport,
  type CompareRunLink,
  type RenderReviewReportOptions,
} from "./review-report.js";
