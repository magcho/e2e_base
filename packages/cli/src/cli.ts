#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotateBindingChanges,
  parsePlaybook,
  planNodesFromScenarioSteps,
  type Binding,
  type PlanNodeView,
  type ReviewBundle,
  type SourceDocument,
  type SourcePlanLink,
  type SourceSpan,
  type Step,
} from "@e2e-base/core";
import { executeScenario } from "@e2e-base/executor";
import { writeHtmlReport, writeReviewHtmlReport } from "@e2e-base/reporter";
import { createDefaultResolver } from "@e2e-base/resolver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function usage(): never {
  console.error(`Usage:
  e2e-base run <playbook-path> [--scenario <name>] [--out <dir>] [--headed] [--serve-fixtures]
  e2e-base review-demo [--out <dir>] [--headed]

Environment:
  OPENAI_API_KEY  optional — enables AI-assisted resolver after heuristic
`);
  process.exit(2);
}

async function serveFixtures(
  root: string,
  port: number,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    try {
      const reqPath = req.url === "/" || !req.url ? "/index.html" : req.url.split("?")[0]!;
      let filePath = path.join(root, path.normalize(reqPath).replace(/^(\.\.[/\\])+/, ""));
      // ディレクトリは index.html を返す（/alt/ → /alt/index.html）
      try {
        const st = await stat(filePath);
        if (st.isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
      } catch {
        // fall through to readFile
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      const type =
        ext === ".html"
          ? "text/html; charset=utf-8"
          : ext === ".css"
            ? "text/css"
            : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

type SourceMapFile = {
  sourceDocumentId: string;
  kind: SourceDocument["kind"];
  label?: string;
  spans: Array<{ id: string; start: number; end: number; label?: string }>;
  linksByStepIndex: Array<{ sourceSpanId: string; stepIndex: number }>;
  syntheticUnmappedPlanNode?: {
    id: string;
    label: string;
    stepType: Step["type"];
  };
};

function buildReviewBundle(input: {
  sourceContent: string;
  sourceMap: SourceMapFile;
  scenarioSteps: Step[];
  result: ReviewBundle["result"];
  runLabel: string;
}): ReviewBundle {
  const sourceDocument: SourceDocument = {
    id: input.sourceMap.sourceDocumentId,
    kind: input.sourceMap.kind,
    content: input.sourceContent,
    label: input.sourceMap.label,
  };
  const sourceSpans: SourceSpan[] = input.sourceMap.spans.map((s) => ({
    id: s.id,
    sourceDocumentId: sourceDocument.id,
    start: s.start,
    end: s.end,
    label: s.label,
  }));
  const planNodes: PlanNodeView[] = planNodesFromScenarioSteps(input.scenarioSteps);
  if (input.sourceMap.syntheticUnmappedPlanNode) {
    planNodes.push({
      id: input.sourceMap.syntheticUnmappedPlanNode.id,
      label: input.sourceMap.syntheticUnmappedPlanNode.label,
      stepType: input.sourceMap.syntheticUnmappedPlanNode.stepType,
      summary: input.sourceMap.syntheticUnmappedPlanNode.label,
    });
  }
  const links: SourcePlanLink[] = [];
  for (const link of input.sourceMap.linksByStepIndex) {
    const step = input.scenarioSteps[link.stepIndex];
    if (!step) {
      throw new Error(`source-map stepIndex out of range: ${link.stepIndex}`);
    }
    links.push({ sourceSpanId: link.sourceSpanId, planNodeId: step.id });
  }
  return {
    sourceDocument,
    sourceSpans,
    links,
    planNodes,
    result: input.result,
    runLabel: input.runLabel,
  };
}

function bindingsByOccurrencePath(steps: ReviewBundle["result"]["steps"]): Record<string, Binding> {
  const out: Record<string, Binding> = {};
  for (const step of steps) {
    if (step.occurrencePath && step.binding) {
      out[step.occurrencePath] = step.binding;
    }
  }
  return out;
}

async function runPlaybook(options: {
  playbookPath: string;
  scenarioName?: string;
  outDir: string;
  headed: boolean;
  serve: boolean;
}): Promise<void> {
  const { playbookPath, scenarioName, outDir, headed, serve } = options;
  let fixtureServer: { url: string; close: () => Promise<void> } | undefined;
  if (serve) {
    fixtureServer = await serveFixtures(path.join(repoRoot, "fixtures"), 4173);
    console.log(`fixtures serving at ${fixtureServer.url}`);
  }

  try {
    const source = await readFile(playbookPath, "utf8");
    const playbook = parsePlaybook(source, { sourcePath: playbookPath });
    if (playbook.scenarios.length === 0) {
      throw new Error("playbook has no scenarios");
    }
    const scenario = scenarioName
      ? playbook.scenarios.find((s) => s.name === scenarioName)
      : playbook.scenarios[0];
    if (!scenario) {
      throw new Error(`scenario not found: ${scenarioName}`);
    }

    await mkdir(outDir, { recursive: true });
    const artifactDir = path.join(outDir, "artifacts");
    const resolver = createDefaultResolver();

    console.log(`Running scenario: ${scenario.name}`);
    const result = await executeScenario({
      playbook,
      scenario,
      resolver,
      artifactDir,
      headless: !headed,
    });

    const reportPath = path.join(outDir, "report.html");
    await writeHtmlReport({
      result,
      outputPath: reportPath,
      playbookPath,
    });

    console.log(`Status: ${result.status}`);
    console.log(`Report: ${reportPath}`);
    for (const step of result.steps) {
      const strategy = step.binding?.strategy ?? "-";
      console.log(
        `  - ${step.status} [${strategy}] ${step.occurrencePath ?? step.stepId}${step.errorMessage ? ` :: ${step.errorMessage}` : ""}`,
      );
    }

    if (result.status !== "passed") process.exitCode = 1;
  } finally {
    await fixtureServer?.close();
  }
}

/**
 * 同一 Playbook を classic / alt の2 fixture で実行し、
 * Binding 差分をレビューシグナルとして載せた 3 カラム Viewer を出す。
 */
async function runReviewDemo(options: { outDir: string; headed: boolean }): Promise<void> {
  const playbookPath = path.join(repoRoot, "examples/submit-form.playbook");
  const sourcePath = path.join(repoRoot, "examples/review/source.txt");
  const sourceMapPath = path.join(repoRoot, "examples/review/source-map.json");
  const outDir = options.outDir;

  const fixtureServer = await serveFixtures(path.join(repoRoot, "fixtures"), 4173);
  console.log(`fixtures serving at ${fixtureServer.url}`);

  try {
    const playbookSource = await readFile(playbookPath, "utf8");
    const playbook = parsePlaybook(playbookSource, { sourcePath: playbookPath });
    const scenario = playbook.scenarios[0];
    if (!scenario) throw new Error("no scenario");

    const sourceContent = await readFile(sourcePath, "utf8");
    const sourceMap = JSON.parse(await readFile(sourceMapPath, "utf8")) as SourceMapFile;
    const resolver = createDefaultResolver();

    await mkdir(outDir, { recursive: true });

    // classic: fixtures/index.html
    console.log("Running classic fixture…");
    const classicDir = path.join(outDir, "classic");
    const classicResult = await executeScenario({
      playbook,
      scenario,
      resolver,
      artifactDir: path.join(classicDir, "artifacts"),
      headless: !options.headed,
    });
    await writeHtmlReport({
      result: classicResult,
      outputPath: path.join(classicDir, "report.html"),
      playbookPath,
    });

    // alt: fixtures/alt/index.html — Binding が css 寄りになる
    console.log("Running alt fixture…");
    const altPlaybookSource = playbookSource.replace(
      "http://127.0.0.1:4173/",
      "http://127.0.0.1:4173/alt/index.html",
    );
    const altPlaybook = parsePlaybook(altPlaybookSource, { sourcePath: playbookPath });
    const altScenario = altPlaybook.scenarios[0]!;
    const altDir = path.join(outDir, "alt");
    let altResult = await executeScenario({
      playbook: altPlaybook,
      scenario: altScenario,
      resolver,
      artifactDir: path.join(altDir, "artifacts"),
      headless: !options.headed,
    });

    // classic の Binding を「前回」として alt にレビューシグナル付与（実行は完了済み）
    const previous = bindingsByOccurrencePath(classicResult.steps);
    altResult = {
      ...altResult,
      steps: annotateBindingChanges(altResult.steps, previous),
    };

    await writeHtmlReport({
      result: altResult,
      outputPath: path.join(altDir, "report.html"),
      playbookPath,
    });

    const classicBundle = buildReviewBundle({
      sourceContent,
      sourceMap,
      scenarioSteps: scenario.steps,
      result: classicResult,
      runLabel: "fixture-classic",
    });
    const altBundle = buildReviewBundle({
      sourceContent,
      sourceMap,
      scenarioSteps: altScenario.steps,
      result: altResult,
      runLabel: "fixture-alt（Binding 変更シグナル付き）",
    });

    const classicReview = await writeReviewHtmlReport({
      bundle: classicBundle,
      outputPath: path.join(classicDir, "review.html"),
      playbookPath,
    });
    const altReview = await writeReviewHtmlReport({
      bundle: altBundle,
      outputPath: path.join(altDir, "review.html"),
      playbookPath,
    });

    // 代表 Viewer を latest 直下にも置く（alt = Binding 変更が見える方）
    await writeReviewHtmlReport({
      bundle: altBundle,
      outputPath: path.join(outDir, "review.html"),
      playbookPath,
    });

    // 機械可読な比較サマリ（reports は gitignore）
    const summary = {
      classicStatus: classicResult.status,
      altStatus: altResult.status,
      bindingChanges: altResult.steps
        .filter((s) => s.bindingChange)
        .map((s) => ({
          occurrencePath: s.occurrencePath,
          previous: s.bindingChange!.previous.locator,
          current: s.bindingChange!.current.locator,
          reason: s.bindingChange!.reason,
        })),
    };
    await writeFile(path.join(outDir, "binding-diff.json"), JSON.stringify(summary, null, 2));

    console.log(`Classic: ${classicResult.status} → ${classicReview}`);
    console.log(`Alt:     ${altResult.status} → ${altReview}`);
    console.log(`Review Viewer: ${path.join(outDir, "review.html")}`);
    console.log(`Binding changes: ${summary.bindingChanges.length}`);
    for (const ch of summary.bindingChanges) {
      console.log(
        `  - ${ch.occurrencePath}: ${JSON.stringify(ch.previous)} → ${JSON.stringify(ch.current)}`,
      );
    }

    if (classicResult.status !== "passed" || altResult.status !== "passed") {
      process.exitCode = 1;
    }
  } finally {
    await fixtureServer.close();
  }
}

async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;
  if (cmd === "review-demo") {
    let outDir = path.join(repoRoot, "reports", "review");
    let headed = false;
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i]!;
      if (a === "--out") outDir = path.resolve(rest[++i]!);
      else if (a === "--headed") headed = true;
      else usage();
    }
    await runReviewDemo({ outDir, headed });
    return;
  }

  if (cmd !== "run" || rest.length === 0) usage();

  let playbookPath = "";
  let scenarioName: string | undefined;
  let outDir = path.join(repoRoot, "reports", "latest");
  let headed = false;
  let serve = false;

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--scenario") {
      scenarioName = rest[++i];
    } else if (a === "--out") {
      outDir = path.resolve(rest[++i]!);
    } else if (a === "--headed") {
      headed = true;
    } else if (a === "--serve-fixtures") {
      serve = true;
    } else if (!a.startsWith("-") && !playbookPath) {
      playbookPath = path.resolve(a);
    } else {
      usage();
    }
  }

  if (!playbookPath) usage();
  await runPlaybook({ playbookPath, scenarioName, outDir, headed, serve });
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
