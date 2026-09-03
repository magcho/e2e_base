#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePlaybook } from "@e2e-base/core";
import { executeScenario } from "@e2e-base/executor";
import { writeHtmlReport } from "@e2e-base/reporter";
import { createDefaultResolver } from "@e2e-base/resolver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function usage(): never {
  console.error(`Usage:
  e2e-base run <playbook-path> [--scenario <name>] [--out <dir>] [--headed] [--serve-fixtures]

Environment:
  OPENAI_API_KEY  optional — enables AI-assisted resolver after heuristic
`);
  process.exit(2);
}

async function serveFixtures(root: string, port: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    try {
      const reqPath = req.url === "/" || !req.url ? "/index.html" : req.url;
      const filePath = path.join(root, path.normalize(reqPath).replace(/^(\.\.[/\\])+/, ""));
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      const type =
        ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css" : "application/octet-stream";
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

async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;
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
      console.log(`  - ${step.status} [${strategy}] ${step.stepId}${step.errorMessage ? ` :: ${step.errorMessage}` : ""}`);
    }

    if (result.status !== "passed") process.exitCode = 1;
  } finally {
    await fixtureServer?.close();
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
