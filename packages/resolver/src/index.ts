export type { ResolveInput, TargetResolver } from "./types.js";
export { HeuristicResolver } from "./heuristic.js";
export { AiAssistedResolver } from "./ai.js";
export {
  CompositeResolver,
  bindingFromLocatorTarget,
  resolveTarget,
  createDefaultResolver,
} from "./composite.js";
