import { childId } from "@e2e-base/core";
import type { Binding, PageCandidate } from "@e2e-base/core";
import type { ResolveInput, TargetResolver } from "./types.js";

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function candidateLabel(c: PageCandidate): string {
  return [c.role, c.name, c.text].filter(Boolean).join(" / ") || c.id;
}

function bindingFromCandidate(
  input: ResolveInput,
  candidate: PageCandidate,
  strategy: Binding["strategy"],
  confidence: number,
  rationale: string,
  considered: PageCandidate[],
): Binding {
  const locator =
    candidate.role != null
      ? {
          strategy: "role" as const,
          value: candidate.role,
          name: candidate.name ?? candidate.text,
        }
      : candidate.cssHint
        ? { strategy: "css" as const, value: candidate.cssHint }
        : {
            strategy: "text" as const,
            value: candidate.name ?? candidate.text ?? input.target.description,
          };

  return {
    id: childId(input.target.id, "bnd", 0, strategy),
    targetId: input.target.id,
    strategy,
    locator,
    confidence,
    rationale,
    candidatesConsidered: considered.map((c) => ({
      label: candidateLabel(c),
      score: c === candidate ? confidence : undefined,
    })),
    resolvedAt: new Date().toISOString(),
  };
}

export class HeuristicResolver implements TargetResolver {
  readonly name = "heuristic";

  async resolve(input: ResolveInput): Promise<Binding | null> {
    const semantic = normalize(input.target.description);
    const candidates = input.pageSnapshot.candidates;

    const nameMatches = candidates.filter(
      (c) => c.name != null && normalize(c.name) === semantic,
    );
    // role 付き（操作可能な要素）を優先し、label のみの重複候補を避ける
    const exactName =
      nameMatches.find((c) => c.role != null) ?? nameMatches[0];
    if (exactName) {
      return bindingFromCandidate(
        input,
        exactName,
        "accessible_name_exact",
        0.95,
        `accessible name が「${semantic}」と完全一致`,
        candidates,
      );
    }

    const roleName = candidates.find(
      (c) =>
        c.role != null &&
        c.name != null &&
        (normalize(`${c.role} ${c.name}`) === semantic ||
          semantic.includes(normalize(c.name))),
    );
    if (roleName) {
      return bindingFromCandidate(
        input,
        roleName,
        "role_name",
        0.8,
        `role=${roleName.role} name「${roleName.name}」が semantic「${semantic}」に適合`,
        candidates,
      );
    }

    const textHit = candidates.find(
      (c) => c.text != null && normalize(c.text).includes(semantic),
    );
    if (textHit) {
      return bindingFromCandidate(
        input,
        textHit,
        "heuristic_fallback",
        0.55,
        `可視テキストが「${semantic}」を含む候補を採用`,
        candidates,
      );
    }

    return null;
  }
}
