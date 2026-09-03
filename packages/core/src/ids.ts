import { createHash } from "node:crypto";
import type { NodeId } from "./types.js";

/** 同一入力に対して決定的な Stable ID を生成する */
export function stableId(scope: string, ...parts: Array<string | number>): NodeId {
  const material = [scope, ...parts.map(String)].join("\0");
  const digest = createHash("sha256").update(material).digest("hex").slice(0, 16);
  return `${scope}_${digest}`;
}

export function childId(parent: NodeId, kind: string, index: number, label = ""): NodeId {
  return stableId(kind, parent, index, label);
}
