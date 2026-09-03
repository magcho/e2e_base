import type { Binding, PageSnapshot, SemanticTarget } from "@e2e-base/core";

export type ResolveInput = {
  target: SemanticTarget;
  pageSnapshot: PageSnapshot;
};

export interface TargetResolver {
  readonly name: string;
  resolve(input: ResolveInput): Promise<Binding | null>;
}
