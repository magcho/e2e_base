# MVP_PLAN — マイルストーンと Done 定義

## 目的

Semantic Target（例: 「送信ボタン」）を Resolve → 実行 → 証跡化できる最小ループを、ローカルで再現可能にする。

## 検証仮説

| ID | 仮説 | 検証方法 |
|----|------|----------|
| H1 | Semantic Target を Playbook に書ける | パーサ単体テスト |
| H2 | accessible name 一致で Binding できる | heuristic resolver テスト + デモ |
| H3 | Binding に従って Playwright が操作できる | executor + fixtures HTML |
| H4 | Resolution 戦略・根拠がレポートに出る | HTML report 目視 / スナップショット |
| H5 | API キー無しでもデモが通る | `pnpm demo` |

## マイルストーン

### M0 — スキャフォールド（完了条件）

- [x] pnpm workspace + TypeScript
- [x] packages: core / resolver / executor / reporter / cli
- [x] docs 一式

### M1 — Parse

- [x] Playbook DSL パーサ
- [x] Stable ID 付与
- [x] Tool 展開（非再帰）ユーティリティ
- [x] Vitest ユニットテスト

### M2 — Resolve

- [x] `TargetResolver` インターフェース
- [x] HeuristicResolver（accessible name 完全一致等）
- [x] AiAssistedResolver（キー無ければスキップ）
- [x] CompositeResolver

### M3 — Execute + Observe

- [x] Playwright で BoundStep 実行
- [x] Screenshot Observation
- [x] Assertion Evaluator（visible / text）
- [x] StepResult 生成

### M4 — Report + Demo

- [x] HTML Reporter（Trace 表示）
- [x] fixtures 静的 HTML
- [x] examples Playbook
- [x] CLI `pnpm demo`
- [x] README

## Done の定義（MVP 全体）

次をすべて満たすこと:

1. `pnpm install` 後、`pnpm test` が成功する
2. fixtures をローカル配信し、`pnpm demo`（または同等 CLI）が Scenario を pass する
3. 生成 HTML に各 Step の **strategy / rationale / status / screenshot** が見える
4. `docs/` が構想・境界・モデル・DSL・計画・タスクを日本語で説明している
5. Binding 型がコード上に存在し、実行 Trace に載る（永続化は不要）

**監査ステータス (2026-09-03):** 上記 1–5 はすべて証拠付きで満たす。詳細は `docs/TASKS.md` の検証証拠を参照。

## 明示的にやらないこと

- NL → Playbook Translation
- Binding DB
- CI クラウドブラウザ
- Auth / API Action
- Plugin SDK の完成

## 次スプリント候補

1. Binding キャッシュ（同一 semantic + ページ指紋）
2. より豊かな candidate 抽出（ARIA ツリー）
3. AI resolver のプロンプト評価ハーネス
4. 並列 Scenario 実行
5. Playwright Trace Viewer 連携
