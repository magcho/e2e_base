import { childId, stableId } from "./ids.js";
import type { LocatorStrategy, Playbook, Scenario, Step, Target, Tool } from "./types.js";

export class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column?: number,
  ) {
    super(`Parse error at line ${line}${column != null ? `:${column}` : ""}: ${message}`);
    this.name = "ParseError";
  }
}

type TokenLine = {
  lineNo: number;
  raw: string;
  indent: string;
  content: string;
};

function stripComment(line: string): string {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === "#" && !inQuote) return line.slice(0, i);
  }
  return line;
}

function tokenize(source: string): TokenLine[] {
  return source.split(/\r?\n/).flatMap((raw, idx) => {
    const withoutComment = stripComment(raw);
    const match = withoutComment.match(/^(\s*)(.*)$/);
    const content = (match?.[2] ?? "").trim();
    if (!content) return [];
    return [
      {
        lineNo: idx + 1,
        raw,
        indent: match?.[1] ?? "",
        content,
      },
    ];
  });
}

function parseStringLiteral(input: string, lineNo: number): { value: string; rest: string } {
  if (!input.startsWith('"')) {
    throw new ParseError(`expected string literal, got: ${input}`, lineNo);
  }
  let i = 1;
  let out = "";
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\") {
      const next = input[i + 1];
      if (next == null) throw new ParseError("unterminated escape in string", lineNo);
      out += next;
      i += 2;
      continue;
    }
    if (ch === '"') {
      return { value: out, rest: input.slice(i + 1).trim() };
    }
    out += ch;
    i += 1;
  }
  throw new ParseError("unterminated string literal", lineNo);
}

function parseIdent(input: string, lineNo: number): { value: string; rest: string } {
  const m = input.match(/^([A-Za-z_][A-Za-z0-9_]*)(.*)$/);
  if (!m) throw new ParseError(`expected identifier, got: ${input}`, lineNo);
  return { value: m[1]!, rest: m[2]!.trim() };
}

function parseTarget(
  input: string,
  lineNo: number,
  parentId: string,
  stepIndex: number,
): { target: Target; rest: string } {
  if (input.startsWith('"')) {
    const { value, rest } = parseStringLiteral(input, lineNo);
    return {
      target: {
        id: childId(parentId, "tgt", stepIndex, value),
        kind: "semantic",
        description: value,
      },
      rest,
    };
  }

  const roleMatch = input.match(/^role=([A-Za-z_][A-Za-z0-9_-]*)\s*(.*)$/);
  if (roleMatch) {
    let rest = roleMatch[2]!.trim();
    let name: string | undefined;
    if (rest.startsWith("name=")) {
      const parsed = parseStringLiteral(rest.slice("name=".length).trim(), lineNo);
      name = parsed.value;
      rest = parsed.rest;
    }
    return {
      target: {
        id: childId(parentId, "tgt", stepIndex, `role:${roleMatch[1]}:${name ?? ""}`),
        kind: "locator",
        strategy: "role",
        value: roleMatch[1]!,
        name,
      },
      rest,
    };
  }

  for (const strategy of ["css", "text", "testid"] as LocatorStrategy[]) {
    const prefix = `${strategy}=`;
    if (input.startsWith(prefix)) {
      const after = input.slice(prefix.length).trim();
      if (!after.startsWith('"')) {
        throw new ParseError(`${strategy}= expects a quoted string`, lineNo);
      }
      const { value, rest } = parseStringLiteral(after, lineNo);
      return {
        target: {
          id: childId(parentId, "tgt", stepIndex, `${strategy}:${value}`),
          kind: "locator",
          strategy,
          value,
        },
        rest,
      };
    }
  }

  throw new ParseError(`invalid target: ${input}`, lineNo);
}

function parseStep(content: string, lineNo: number, parentId: string, index: number): Step {
  const parts = content.match(/^([A-Z]+)\s*(.*)$/);
  if (!parts) throw new ParseError(`invalid step: ${content}`, lineNo);
  const keyword = parts[1]!;
  const rest = parts[2]!.trim();

  switch (keyword) {
    case "NAVIGATE": {
      const url = parseStringLiteral(rest, lineNo);
      if (url.rest) throw new ParseError(`unexpected token after NAVIGATE: ${url.rest}`, lineNo);
      return {
        id: childId(parentId, "stp", index, `NAVIGATE:${url.value}`),
        type: "NAVIGATE",
        url: url.value,
      };
    }
    case "CLICK": {
      const target = parseTarget(rest, lineNo, parentId, index);
      if (target.rest) throw new ParseError(`unexpected token after CLICK: ${target.rest}`, lineNo);
      return {
        id: childId(parentId, "stp", index, "CLICK"),
        type: "CLICK",
        target: target.target,
      };
    }
    case "TYPE": {
      const target = parseTarget(rest, lineNo, parentId, index);
      if (!target.rest.startsWith('"')) {
        throw new ParseError("TYPE requires a text string after target", lineNo);
      }
      const text = parseStringLiteral(target.rest, lineNo);
      if (text.rest) throw new ParseError(`unexpected token after TYPE text: ${text.rest}`, lineNo);
      return {
        id: childId(parentId, "stp", index, "TYPE"),
        type: "TYPE",
        target: target.target,
        text: text.value,
      };
    }
    case "ASSERT": {
      const kindMatch = rest.match(/^(visible|text)\s+(.*)$/);
      if (!kindMatch) throw new ParseError("ASSERT requires 'visible' or 'text'", lineNo);
      const assertion = kindMatch[1] as "visible" | "text";
      const target = parseTarget(kindMatch[2]!.trim(), lineNo, parentId, index);
      if (assertion === "visible") {
        if (target.rest) {
          throw new ParseError(`unexpected token after ASSERT visible: ${target.rest}`, lineNo);
        }
        return {
          id: childId(parentId, "stp", index, "ASSERT:visible"),
          type: "ASSERT",
          assertion: "visible",
          target: target.target,
        };
      }
      if (!target.rest.startsWith('"')) {
        throw new ParseError("ASSERT text requires expected string", lineNo);
      }
      const expected = parseStringLiteral(target.rest, lineNo);
      if (expected.rest) {
        throw new ParseError(`unexpected token after ASSERT text: ${expected.rest}`, lineNo);
      }
      return {
        id: childId(parentId, "stp", index, "ASSERT:text"),
        type: "ASSERT",
        assertion: "text",
        target: target.target,
        expected: expected.value,
      };
    }
    case "CALL": {
      const name = parseIdent(rest, lineNo);
      if (name.rest) throw new ParseError(`unexpected token after CALL: ${name.rest}`, lineNo);
      return {
        id: childId(parentId, "stp", index, `CALL:${name.value}`),
        type: "CALL",
        toolName: name.value,
      };
    }
    default:
      throw new ParseError(`unknown keyword: ${keyword}`, lineNo);
  }
}

export type ParsePlaybookOptions = {
  sourcePath?: string;
};

export function parsePlaybook(source: string, options: ParsePlaybookOptions = {}): Playbook {
  const lines = tokenize(source);
  if (lines.length === 0) throw new ParseError("empty playbook", 1);

  const first = lines[0]!;
  if (!first.content.startsWith("playbook ")) {
    throw new ParseError('playbook must start with: playbook "name"', first.lineNo);
  }
  const title = parseStringLiteral(first.content.slice("playbook ".length).trim(), first.lineNo);
  if (title.rest) throw new ParseError(`unexpected token: ${title.rest}`, first.lineNo);

  const playbookId = stableId("pb", options.sourcePath ?? "", title.value);
  const tools: Tool[] = [];
  const scenarios: Scenario[] = [];

  let i = 1;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.content.startsWith("tool ")) {
      const name = parseIdent(line.content.slice("tool ".length).trim(), line.lineNo);
      if (name.rest) throw new ParseError(`unexpected token: ${name.rest}`, line.lineNo);
      const toolId = childId(playbookId, "tool", tools.length, name.value);
      const steps: Step[] = [];
      i += 1;
      while (i < lines.length && lines[i]!.content !== "end") {
        steps.push(parseStep(lines[i]!.content, lines[i]!.lineNo, toolId, steps.length));
        i += 1;
      }
      if (i >= lines.length) throw new ParseError(`tool "${name.value}" missing end`, line.lineNo);
      for (const step of steps) {
        if (step.type === "CALL") {
          throw new ParseError(
            `tool "${name.value}" must not contain CALL (recursion forbidden)`,
            line.lineNo,
          );
        }
      }
      tools.push({ id: toolId, name: name.value, steps });
      i += 1;
      continue;
    }

    if (line.content.startsWith("scenario ")) {
      const name = parseStringLiteral(line.content.slice("scenario ".length).trim(), line.lineNo);
      if (name.rest) throw new ParseError(`unexpected token: ${name.rest}`, line.lineNo);
      const scenarioId = childId(playbookId, "scn", scenarios.length, name.value);
      const steps: Step[] = [];
      i += 1;
      while (i < lines.length && lines[i]!.content !== "end") {
        steps.push(parseStep(lines[i]!.content, lines[i]!.lineNo, scenarioId, steps.length));
        i += 1;
      }
      if (i >= lines.length) {
        throw new ParseError(`scenario "${name.value}" missing end`, line.lineNo);
      }
      scenarios.push({ id: scenarioId, name: name.value, steps });
      i += 1;
      continue;
    }

    throw new ParseError(`unexpected block: ${line.content}`, line.lineNo);
  }

  const toolNames = new Set<string>();
  for (const tool of tools) {
    if (toolNames.has(tool.name)) {
      throw new ParseError(`duplicate tool name: ${tool.name}`, 1);
    }
    toolNames.add(tool.name);
  }

  return {
    id: playbookId,
    sourcePath: options.sourcePath,
    tools,
    scenarios,
  };
}
