import { childId } from "@e2e-base/core";
import type { Binding } from "@e2e-base/core";
import type { ResolveInput, TargetResolver } from "./types.js";

export type AiAssistedResolverOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

/**
 * OpenAI Chat Completions で候補 ID を選ばせる。
 * API キーが無い、または呼び出し失敗時は null（次の Resolver へ）。
 */
export class AiAssistedResolver implements TargetResolver {
  readonly name = "ai_assisted";
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AiAssistedResolverOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async resolve(input: ResolveInput): Promise<Binding | null> {
    if (!this.apiKey) return null;
    const { candidates } = input.pageSnapshot;
    if (candidates.length === 0) return null;

    const prompt = [
      "You are a UI target resolver for browser automation.",
      "Pick the best candidate id for the semantic target.",
      `Semantic target: ${input.target.description}`,
      "Candidates (JSON):",
      JSON.stringify(
        candidates.map((c) => ({
          id: c.id,
          role: c.role,
          name: c.name,
          text: c.text,
        })),
        null,
        2,
      ),
      'Respond with JSON only: {"id":"...","rationale":"..."}',
    ].join("\n");

    try {
      const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return strict JSON." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as { id?: string; rationale?: string };
      const chosen = candidates.find((c) => c.id === parsed.id);
      if (!chosen) return null;

      const locator =
        chosen.role != null
          ? {
              strategy: "role" as const,
              value: chosen.role,
              name: chosen.name ?? chosen.text,
            }
          : chosen.cssHint
            ? { strategy: "css" as const, value: chosen.cssHint }
            : {
                strategy: "text" as const,
                value: chosen.name ?? chosen.text ?? input.target.description,
              };

      return {
        id: childId(input.target.id, "bnd", 0, "ai_assisted"),
        targetId: input.target.id,
        strategy: "ai_assisted",
        locator,
        confidence: 0.7,
        rationale: parsed.rationale ?? "AI selected candidate",
        candidatesConsidered: candidates.map((c) => ({
          label: [c.role, c.name, c.text].filter(Boolean).join(" / ") || c.id,
          score: c.id === chosen.id ? 0.7 : undefined,
        })),
        resolvedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
}
