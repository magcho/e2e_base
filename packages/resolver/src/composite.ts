import { childId } from "@e2e-base/core";
import type { Binding, LocatorTarget, Target } from "@e2e-base/core";
import { AiAssistedResolver } from "./ai.js";
import { HeuristicResolver } from "./heuristic.js";
import type { ResolveInput, TargetResolver } from "./types.js";

export class CompositeResolver implements TargetResolver {
  readonly name = "composite";

  constructor(private readonly resolvers: TargetResolver[]) {}

  async resolve(input: ResolveInput): Promise<Binding | null> {
    for (const resolver of this.resolvers) {
      const binding = await resolver.resolve(input);
      if (binding) return binding;
    }
    return null;
  }
}

export function bindingFromLocatorTarget(target: LocatorTarget): Binding {
  return {
    id: childId(target.id, "bnd", 0, "explicit_locator"),
    targetId: target.id,
    strategy: "explicit_locator",
    locator: {
      strategy: target.strategy,
      value: target.value,
      name: target.name,
    },
    confidence: 1,
    rationale: "Playbook 上の明示 Locator",
    resolvedAt: new Date().toISOString(),
  };
}

export async function resolveTarget(
  target: Target,
  pageSnapshot: ResolveInput["pageSnapshot"],
  resolver: TargetResolver,
): Promise<Binding> {
  if (target.kind === "locator") {
    return bindingFromLocatorTarget(target);
  }
  const binding = await resolver.resolve({ target, pageSnapshot });
  if (!binding) {
    throw new Error(
      `Failed to resolve semantic target: "${target.description}" (candidates=${pageSnapshot.candidates.length})`,
    );
  }
  return binding;
}

/** Progressive Resolution: heuristic → AI（キーがある場合） */
export function createDefaultResolver(options: { apiKey?: string } = {}): TargetResolver {
  const heuristic = new HeuristicResolver();
  const ai = new AiAssistedResolver({ apiKey: options.apiKey });
  return new CompositeResolver(ai.enabled ? [heuristic, ai] : [heuristic]);
}
