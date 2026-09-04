# AGENTS.md — AI / エージェント向けガイド

このリポジトリで作業するエージェント向けの実行可能な指針です。人間のオンボーディングは [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を優先してください。

## 目的

Web 操作の **仕様 → 解決 → 実行 → 観測 → 評価 → 証跡 → 報告** を一本化する実行基盤（MVP）。最重要仮説は、Semantic Target（例: 「送信ボタン」）を Resolve し、人間が操作と判断根拠を追跡できる Binding / Trace 付きレポートを残せること。

技術 MVP 後のプロダクト方針は [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) を参照する。今後は、Translation と Runtime の分離、Git に固定する Canonical Playbook IR、Qualification / Verification、3 カラム Review Viewer を判断の前提とする。ただし、同文書の将来モデルを実装済みとみなしてはならない。

## パッケージ境界

| パッケージ | 責務 | 依存してよいもの |
|------------|------|------------------|
| `@e2e-base/core` | IR / 型 / パーサ / Tool 展開 | なし |
| `@e2e-base/resolver` | Semantic → Binding | `core` |
| `@e2e-base/executor` | Playwright 実行 / Observation / Evaluation | `core`, `resolver` |
| `@e2e-base/reporter` | HTML Evidence Report | `core` |
| `@e2e-base/cli` | エントリ・配線 | 上記すべて |

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。境界をまたぐ依存追加はしない。

## MVP 範囲

**やってよい**

- Semantic / Locator Target、Binding、Trace を壊さない改善
- heuristic / AI resolver の精度向上（根拠をレポートに残す）
- テスト・fixtures・examples・ドキュメントの充実
- 開発者体験（lint / typecheck / DX）の薄い改善
- 品質ゲート（`pnpm check` / git hooks / CI の unit 検査）の維持・改善

**やらない（明示的スコープ外）**

- NL → Playbook Translation
- Binding DB / 永続ストアの本格化
- CI での Playwright ブラウザデモ（クラウドブラウザ）
- Auth / API Action
- Plugin SDK の完成
- IR（`@e2e-base/core` の型）の無秩序な肥大化

次スプリント候補は [docs/MVP_PLAN.md](docs/MVP_PLAN.md) を参照。

## 設計原則（必須）

1. **Semantic Target / Binding / Trace** を第一級に保つ。操作は Locator に落ちても、解決根拠を捨てない。
2. **IR を肥大化させない**。新しい概念は `docs/DOMAIN_MODEL.md` と整合させてから型に入れる。
3. **core は Playwright / OpenAI に依存しない**。副作用のあるページ操作は resolver では行わない。
4. **パッケージ境界を守る**。executor は現在のページ状態を Resolver に渡すが、Resolution の判断ロジックを実装しない。reporter は再実行しない。
5. **Qualification の環境安全性を Runtime の必須責務へ広げない**。初回実行の承認フロー、サンドボックス、接続先制限を暗黙の要件として追加しない。安全機能を追加する場合も任意機能として分離する。
6. **Binding の変化だけで既定の実行を停止しない**。後続 Step まで実行して Report を完成させ、Binding 差分は Assertion 失敗と分けたレビューシグナルとして記録・表示する。

## 主要コマンド

```bash
pnpm install
pnpm playwright:install   # Chromium（デモ用・初回）
pnpm build
pnpm check                # build + typecheck + lint + format:check + test（必須ゲート）
pnpm demo                 # reports/latest/report.html
```

変更後・PR 前は `pnpm check` を通す。CI も同じゲート。hooks: commit=`lint-staged`、push=`pnpm check`。

## ドキュメントへのポインタ

| 読みたいこと | ファイル |
|--------------|----------|
| 構想 | [docs/VISION.md](docs/VISION.md) |
| プロダクト方針・決定・未決事項 | [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) |
| 境界・シーケンス | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 型・Trace | [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) |
| DSL | [docs/PLAYBOOK_DSL.md](docs/PLAYBOOK_DSL.md) |
| Done / 非目標 | [docs/MVP_PLAN.md](docs/MVP_PLAN.md) |
| タスク・検証証拠 | [docs/TASKS.md](docs/TASKS.md) |
| セットアップ手順 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| 検査手順の提出（エージェント用） | [skills/e2e-playbook/SKILL.md](skills/e2e-playbook/SKILL.md) |

アプリ実装後に再実行可能な `.playbook` を提出するときは、NL→IR Translator ではなく **[e2e-playbook Skill](skills/e2e-playbook/SKILL.md)** に従う。形式チェックは既存パーサ、意味確認は Runtime + Report（Qualification）とする。

## エージェント作業ルール

- **コミット・push はユーザーが明示したときだけ**。勝手に作らない・送らない。
- `docs/`・README・examples・fixtures・コア実装はコンテキスト資産として **削除しない**。
- 秘密情報（`.env`、API キー）をコミットしない。`.env.example` に説明のみ置く。
- 生成物（`reports/`、`dist/`、`coverage/`）をソース扱いしない。
- コメント・ドキュメント・コミットメッセージは **日本語** で揃える。
- 変更は必要最小限。過剰な一般化・巨大リファクタは避ける。

## サンプル資産（残す）

- `examples/submit-form.playbook` — デモ用 Playbook
- `fixtures/` — ローカル静的 HTML（`--serve-fixtures`）
- `docs/` — 設計・計画一式
- `skills/e2e-playbook/` — エージェントが Playbook を提出するための Skill
