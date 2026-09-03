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
pnpm test
```

Playwright のブラウザはリポジトリに含まれません。初回（または CI クリーン環境）では必ず `pnpm playwright:install` を実行してください。

## よく使うコマンド

| コマンド | 内容 |
|----------|------|
| `pnpm build` | 全パッケージを `tsc` ビルド |
| `pnpm test` | Vitest（各パッケージ） |
| `pnpm typecheck` | 型チェック（`--noEmit`） |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier で整形 |
| `pnpm demo` | fixtures 配信 + サンプル Playbook 実行 → `reports/latest/report.html` |
| `pnpm playwright:install` | Chromium インストール |

デモ成功後は `reports/latest/report.html` をブラウザで開き、各 Step の strategy / Binding / screenshot を確認します。

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
- [PLAYBOOK_DSL.md](./PLAYBOOK_DSL.md) — DSL
- [MVP_PLAN.md](./MVP_PLAN.md) — Done / 非目標
- [TASKS.md](./TASKS.md) — タスクボード
- ルート [AGENTS.md](../AGENTS.md) — AI 向けガイド
