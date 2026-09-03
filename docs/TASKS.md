# TASKS — MVP タスクボード

凡例: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了

最終更新: 2026-09-03（監査 + Binding 品質修正後）

## ドキュメント

- [x] `docs/VISION.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/DOMAIN_MODEL.md`
- [x] `docs/PLAYBOOK_DSL.md`
- [x] `docs/MVP_PLAN.md`
- [x] `docs/TASKS.md`（本ファイル）

## スキャフォールド

- [x] pnpm workspace / root scripts
- [x] `packages/core` package.json + tsconfig
- [x] `packages/resolver` package.json + tsconfig
- [x] `packages/executor` package.json + tsconfig
- [x] `packages/reporter` package.json + tsconfig
- [x] `packages/cli` package.json + tsconfig
- [x] fixtures 静的 HTML
- [x] examples Playbook
- [x] README.md

## core

- [x] ドメイン型（Target / Binding / Step / Scenario / StepResult）
- [x] Stable ID 生成（決定的）
- [x] Playbook パーサ
- [x] Tool 展開（CALL、再帰禁止）
- [x] パーサ / 展開の Vitest

## resolver

- [x] `TargetResolver` インターフェース
- [x] HeuristicResolver
- [x] AiAssistedResolver（スタブ + キーあれば実呼び出し）
- [x] CompositeResolver
- [x] ユニットテスト（heuristic / role 優先）

## executor

- [x] Playwright 起動 / ページ操作
- [x] BoundStep 実行（NAVIGATE/CLICK/TYPE/ASSERT）
- [x] Observation（screenshot）
- [x] Evaluator（visible / text）
- [x] StepResult 収集
- [x] label 関連付けによる textbox 候補の accessible name 抽出

## reporter

- [x] ScenarioResult → HTML
- [x] Resolution Trace（strategy / binding / rationale）表示
- [x] screenshot 埋め込みまたは相対リンク

## cli / 統合

- [x] `e2e-base run <playbook>` エントリ
- [x] heuristic のみでデモ成功
- [x] `pnpm test` 緑
- [x] `pnpm demo` 緑（Status: passed）
- [x] `pnpm playwright:install` スクリプト

## 検証証拠（2026-09-03）

| コマンド / 成果物 | 結果 |
|-------------------|------|
| `pnpm test` | core 5 + resolver 4 = 全パス |
| `pnpm demo` | Status: passed（6 steps） |
| `reports/latest/report.html` | strategy / Locator / Rationale / screenshot 表示 |
| `reports/latest/artifacts/step-*.png` | 6 枚生成 |

## 完了サマリ

| 領域 | 状態 |
|------|------|
| docs | 完了 |
| core | 完了（テスト 5） |
| resolver | 完了（テスト 4） |
| executor | 完了（デモで検証） |
| reporter | 完了（デモで HTML 生成） |
| cli/demo | 完了（Status: passed） |

## MVP 外（明示的に未着手）

- NL → Playbook Translation
- Binding DB / 永続化
- Tool 引数（`CALL` args）
- CI クラウドブラウザ
- Auth / API Action
- Plugin SDK
