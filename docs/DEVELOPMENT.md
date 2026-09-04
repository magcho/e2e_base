# DEVELOPMENT — 開発者オンボーディング

継続開発のためのセットアップ・コマンド・パッケージ責務の短いガイドです。構想・境界の詳細は他の `docs/` を参照してください。

## 前提

| 項目 | 推奨 |
|------|------|
| Node.js | 20 以上（`.nvmrc` は `20`） |
| パッケージマネージャ | pnpm 9（`packageManager` フィールド準拠） |
| ブラウザ | Playwright Chromium（`pnpm playwright:install`） |

任意: AI resolver を試す場合のみ `OPENAI_API_KEY`（`.env.example` 参照）。デモ本体はキー無しで動きます。

## 初回セットアップ

```bash
pnpm install
pnpm playwright:install
pnpm build
pnpm check
```

`pnpm install` 時に `simple-git-hooks` が入り、以降の commit / push で品質ゲートが走ります。  
Playwright のブラウザはリポジトリに含まれません。デモ実行時（またはクリーン環境）では `pnpm playwright:install` を実行してください。ユニットテストの `pnpm check` には不要です。

## よく使うコマンド

| コマンド | 内容 |
|----------|------|
| `pnpm check` | **統合品質ゲート**（build → typecheck → lint → format:check → test） |
| `pnpm build` | 全パッケージを `tsc` ビルド |
| `pnpm test` | Vitest（各パッケージ） |
| `pnpm typecheck` | 型チェック（`--noEmit`） |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier 整形 / 検査 |
| `pnpm demo` | fixtures 配信 + サンプル Playbook 実行 → `reports/latest/report.html` |
| `pnpm demo:review` | classic/alt 2 fixture で同一 Playbook を実行 → 3 カラム Review Viewer（`reports/review/review.html`） |
| `pnpm playwright:install` | Chromium インストール |

PR 作成前や大きな変更後は `pnpm check` を通すのが標準フローです。

## ローカル作業フロー（品質ゲート）

| タイミング | 何が走るか |
|------------|------------|
| `git commit`（pre-commit） | `lint-staged`（staged な TS/JS に ESLint --fix、対象ファイルに Prettier） |
| `git push`（pre-push） | `pnpm check`（build / typecheck / lint / format:check / test） |
| 手動 / CI | 同じく `pnpm check` |

フックを入れ直す場合: `pnpm prepare`（または再 `pnpm install`）。

## CI

GitHub Actions（[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)）が `main` への push と全 PR で `pnpm check` を実行します。  
ブラウザ付きデモ（`pnpm demo`）は CI では走らせません（クラウドブラウザはスコープ外）。

## パッケージの責務（要約）

| パッケージ | 責務 |
|------------|------|
| `@e2e-base/core` | IR・型・パーサ・Tool 展開（純粋） |
| `@e2e-base/resolver` | Semantic → Binding（heuristic / AI） |
| `@e2e-base/executor` | Playwright 実行・Observation・Evaluation |
| `@e2e-base/reporter` | HTML Evidence Report |
| `@e2e-base/cli` | `e2e-base run` オーケストレーション |

境界の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md)。

## レポート確認

1. `pnpm demo` を実行する
2. `reports/latest/report.html` を開く
3. 各 Step に Resolution strategy・Binding・status・screenshot があることを確認する

### Review Viewer（3 カラム）デモ

同一 Canonical Playbook を UI の異なる 2 fixture（`fixtures/index.html` と `fixtures/alt/`）で実行し、Source / Plan / Observation を照合する。

```bash
pnpm demo:review
```

1. `reports/review/review.html` を開く（alt 実行・Binding 変更シグナル付き）
2. 左の Source Span または中央の Step をクリック／ホバーし、他カラムのハイライトを確認する
3. 右カラムで before / after（または assertion）Screenshot を切り替える
4. Binding が変わった Step に「Binding 変更」シグナルが出ていることを確認する（実行は止まらない）
5. 未マッピング Source・未マッピング Plan・（必要なら）未実行 Step が隠れていないことを確認する

手書き Source と Source Map は `examples/review/`。データ例は `docs/examples/review-viewer-data-example.json`。モデル変更理由は [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) の Review Viewer 節。

`reports/` は生成物のため gitignore 対象です。

## リモートとの初回同期（注意）

ローカル `main`（例: `25e6fa7` の MVP）と `origin/main`（例: `b9d17e4` Initial commit）が **分岐している**場合があります。以前の通常 push は non-fast-forward で失敗しています。

方針の例（実行は人間が判断）:

1. `git fetch origin` で remote を確認する
2. remote に残したい独自コミットが無ければ、履歴方針を決めたうえで push（必要なら force-with-lease）。**エージェントは勝手に force push しない**
3. remote に残したい変更がある場合は、rebase / merge 戦略を先に合意する

このリポジトリでは **コミット・push は明示依頼時のみ**行います。

## 関連ドキュメント

- [VISION.md](./VISION.md) — 構想
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 境界
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) — 型
- [PRODUCT_DIRECTION.md](./PRODUCT_DIRECTION.md) — プロダクト方針
- [PLAYBOOK_DSL.md](./PLAYBOOK_DSL.md) — DSL
- [MVP_PLAN.md](./MVP_PLAN.md) — Done / 非目標
- [TASKS.md](./TASKS.md) — タスクボード
- ルート [AGENTS.md](../AGENTS.md) — AI 向けガイド
