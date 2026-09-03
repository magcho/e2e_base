import { describe, expect, it } from "vitest";
import { expandScenarioSteps } from "../src/expand.js";
import { parsePlaybook, ParseError } from "../src/parser.js";
import { stableId } from "../src/ids.js";

const SAMPLE = `
playbook "demo"

tool fill_form
  TYPE "名前入力" "magcho"
  TYPE "メール入力" "magcho@example.com"
end

scenario "送信まで"
  NAVIGATE "http://127.0.0.1:4173/"
  CALL fill_form
  CLICK "送信ボタン"
  ASSERT visible "成功メッセージ"
  ASSERT text "成功メッセージ" "送信しました"
  CLICK role=button name="別ボタン"
  CLICK css="#ok"
end
`;

describe("stableId", () => {
  it("is deterministic", () => {
    expect(stableId("pb", "a", "b")).toBe(stableId("pb", "a", "b"));
    expect(stableId("pb", "a", "b")).not.toBe(stableId("pb", "a", "c"));
  });
});

describe("parsePlaybook", () => {
  it("parses tools, scenarios, semantic and locator targets", () => {
    const pb = parsePlaybook(SAMPLE, { sourcePath: "examples/demo.playbook" });
    expect(pb.tools).toHaveLength(1);
    expect(pb.scenarios).toHaveLength(1);
    expect(pb.tools[0]!.name).toBe("fill_form");
    expect(pb.scenarios[0]!.name).toBe("送信まで");
    expect(pb.scenarios[0]!.steps.map((s) => s.type)).toEqual([
      "NAVIGATE",
      "CALL",
      "CLICK",
      "ASSERT",
      "ASSERT",
      "CLICK",
      "CLICK",
    ]);
    const click = pb.scenarios[0]!.steps[2]!;
    expect(click.type).toBe("CLICK");
    if (click.type === "CLICK") {
      expect(click.target.kind).toBe("semantic");
      if (click.target.kind === "semantic") {
        expect(click.target.description).toBe("送信ボタン");
      }
    }
  });

  it("rejects CALL inside tool", () => {
    const src = `
playbook "x"
tool t
  CALL other
end
scenario "s"
  CALL t
end
`;
    expect(() => parsePlaybook(src)).toThrow(ParseError);
  });

  it("ignores comments", () => {
    const pb = parsePlaybook(`
playbook "x"
# comment
scenario "s"
  NAVIGATE "http://example.com" # trailing
end
`);
    expect(pb.scenarios[0]!.steps).toHaveLength(1);
  });
});

describe("expandScenarioSteps", () => {
  it("expands CALL once", () => {
    const pb = parsePlaybook(SAMPLE);
    const expanded = expandScenarioSteps(pb, pb.scenarios[0]!);
    expect(expanded.map((s) => s.type)).toEqual([
      "NAVIGATE",
      "TYPE",
      "TYPE",
      "CLICK",
      "ASSERT",
      "ASSERT",
      "CLICK",
      "CLICK",
    ]);
  });
});
