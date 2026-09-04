import { describe, expect, it } from "vitest";
import type { SemanticTarget } from "@e2e-base/core";
import { HeuristicResolver } from "../src/heuristic.js";
import { createDefaultResolver } from "../src/composite.js";

const target: SemanticTarget = {
  id: "tgt_test",
  kind: "semantic",
  description: "送信ボタン",
};

describe("HeuristicResolver", () => {
  it("matches accessible name exactly", async () => {
    const resolver = new HeuristicResolver();
    const binding = await resolver.resolve({
      target,
      pageSnapshot: {
        candidates: [
          { id: "c1", role: "textbox", name: "名前" },
          { id: "c2", role: "button", name: "送信ボタン", cssHint: "#submit" },
        ],
      },
    });
    expect(binding).not.toBeNull();
    expect(binding!.strategy).toBe("accessible_name_exact");
    expect(binding!.locator.strategy).toBe("role");
    expect(binding!.locator.name).toBe("送信ボタン");
  });

  it("returns null when no candidate matches", async () => {
    const resolver = new HeuristicResolver();
    const binding = await resolver.resolve({
      target,
      pageSnapshot: { candidates: [{ id: "c1", role: "button", name: "キャンセル" }] },
    });
    expect(binding).toBeNull();
  });

  it("prefers role-bearing candidate over label-only duplicate", async () => {
    const resolver = new HeuristicResolver();
    const binding = await resolver.resolve({
      target,
      pageSnapshot: {
        candidates: [
          { id: "c-label", name: "送信ボタン", text: "送信ボタン" },
          { id: "c-btn", role: "button", name: "送信ボタン", cssHint: "#submit" },
        ],
      },
    });
    expect(binding!.locator.strategy).toBe("role");
    expect(binding!.locator.value).toBe("button");
  });

  it("matches accessible name case-insensitively", async () => {
    const resolver = new HeuristicResolver();
    const binding = await resolver.resolve({
      target: { id: "tgt_men", kind: "semantic", description: "Men" },
      pageSnapshot: {
        candidates: [
          { id: "c1", role: "link", name: "WOMEN" },
          { id: "c2", role: "link", name: "MEN", cssHint: 'a[href="#Men"]' },
        ],
      },
    });
    expect(binding).not.toBeNull();
    expect(binding!.strategy).toBe("accessible_name_exact");
    expect(binding!.locator.name).toBe("MEN");
  });
});

describe("createDefaultResolver", () => {
  it("works without API key", async () => {
    const resolver = createDefaultResolver({ apiKey: "" });
    const binding = await resolver.resolve({
      target,
      pageSnapshot: {
        candidates: [{ id: "c1", role: "button", name: "送信ボタン" }],
      },
    });
    expect(binding?.strategy).toBe("accessible_name_exact");
  });
});
