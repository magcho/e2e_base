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

技術 MVP 完了後のプロダクト壁打ちにより、先に実行核の利用モデルと人間による確認方法を固める方針に更新した。詳細は [PRODUCT_DIRECTION.md](./PRODUCT_DIRECTION.md) を参照する。

1. 現行モデルと Canonical Playbook IR 構想の差分整理
2. Source Span と Plan Node の多対多 Mapping / Source Map 設計
3. Tool 展開後の Step occurrence と前後 Observation のモデル設計
4. Source / Plan・Trace / Observation を並べる 3 カラム Review Viewer のプロトタイプ
5. Qualification と Verification、再認定条件のユースケース検証
6. Binding の再利用方針と Binding 変更の可視化

Binding キャッシュ、ARIA ツリー、AI resolver 評価、並列 Scenario、Playwright Trace Viewer 連携は引き続き候補だが、上記のプロダクトモデルにおける必要性と優先順位を確認してから着手する。
