# e2e_base

Web 操作の **仕様 → 解決 → 実行 → 観測 → 評価 → 証跡 → 報告** を一本のパイプラインとして扱う実行基盤の MVP です。

最重要仮説: 「送信ボタン」のような **Semantic Target** を Resolve し、監査可能な形で実行・証跡を残せるか。

## ドキュメント

- [構想 (VISION)](docs/VISION.md)
- [アーキテクチャ](docs/ARCHITECTURE.md)
- [ドメインモデル](docs/DOMAIN_MODEL.md)
- [Playbook DSL](docs/PLAYBOOK_DSL.md)
- [MVP 計画](docs/MVP_PLAN.md)
- [タスクボード](docs/TASKS.md)

## パッケージ構成

| パッケージ | 役割 |
|------------|------|
| `@e2e-base/core` | IR / ドメイン型 / Playbook パーサ / Tool 展開 |
| `@e2e-base/resolver` | Semantic → Binding（heuristic + 差し替え可能な AI） |
| `@e2e-base/executor` | Playwright 実行 / Observation / Evaluation |
| `@e2e-base/reporter` | HTML Evidence Report |
| `@e2e-base/cli` | `e2e-base run` エントリ |

## セットアップ

要件: Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm playwright:install
pnpm build
```

## テスト

```bash
pnpm test
```

## デモ実行

fixtures（静的 HTML）を一時サーブしつつ、サンプル Playbook を実行します。API キーは不要です（heuristic resolver）。

```bash
pnpm demo
```

成功すると `reports/latest/report.html` に Trace（Resolution strategy / Binding / Screenshot）付きレポートが出力されます。

任意で AI resolver を有効化:

```bash
export OPENAI_API_KEY=sk-...
pnpm demo
```

## CLI

```bash
pnpm --filter @e2e-base/cli exec node ./dist/cli.js run ../../examples/submit-form.playbook --serve-fixtures
```

オプション:

- `--scenario <name>` — 実行する Scenario 名
- `--out <dir>` — レポート出力先（既定: `reports/latest`）
- `--headed` — ブラウザを表示
- `--serve-fixtures` — `fixtures/` を `http://127.0.0.1:4173` で配信

## パイプライン（MVP）

```
Playbook Parser → Scenario/AST → BrowserAction/Assertion/ToolCall
→ Target Resolver → Playwright Executor
→ Screenshot/Observation → StepResult → HTML Report
```

操作語彙: `CLICK`, `TYPE`, `NAVIGATE`, `ASSERT visible`, `ASSERT text`, `CALL`
