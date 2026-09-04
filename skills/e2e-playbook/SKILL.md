---
name: e2e-playbook
description: Use when an agent must submit re-runnable web inspection steps for e2e_base after implementing an app, when replacing one-off screenshots with a .playbook, or when asked to write or revise Playbook DSL scenarios for Qualification.
---

# e2e_base Playbook 提出

## Overview

アプリ実装後に「何を確認したか」を、一回限りのスクショではなく **再実行可能な `.playbook`** として提出する。実行・Resolve・画面操作は Runtime に任せ、ここでは手順を書くことだけに集中する。

## When to Use

- 実装完了後、人間が追える検査手順を残すとき
- 「動作確認した」証拠を `e2e_base` で提出するとき
- 既存 Scenario を直して再 Qualification するとき

**使わないとき**

- ブラウザを自由探索して目的達成だけしたいとき（本プロダクトの対象外）
- NL→IR の本格 Translator を実装するとき（別機構・後続）
- Runtime / Resolver / Reporter 自体の改修だけが目的のとき

## 提出フロー

```text
1. .playbook を書く（Semantic Target 優先）
2. 既存パーサが通る形にする（構文エラーなし）
3. Runtime で実行し Report を残す
4. 人間が意図どおりか確認する（Qualification）
```

形式チェックは **新規 Validator を増やさない**。`parsePlaybook`（`e2e-base run` の入口）が通れば形式 OK。意味的な妥当性は実行と Report で確認する。

## 出力形式

- ファイル: `*.playbook`（または `*.pb`）
- 手本: `examples/submit-form.playbook`
- 構文の正: `docs/PLAYBOOK_DSL.md`

最小例:

```
playbook "feature-name"

scenario "何を確認するか一文で"
  NAVIGATE "http://127.0.0.1:4173/"
  TYPE "名前入力" "magcho"
  CLICK "送信ボタン"
  ASSERT visible "成功メッセージ"
  ASSERT text "成功メッセージ" "送信しました"
end
```

再利用する Step 列だけ `tool` + `CALL` にする（Tool 内に `CALL` は禁止）。

## 語彙（MVP）

| キーワード | 用途 |
|------------|------|
| `NAVIGATE` | URL へ遷移 |
| `CLICK` | クリック |
| `TYPE` | 入力（既存値はクリアされる前提） |
| `ASSERT visible` | 表示されていること |
| `ASSERT text` | テキストが期待を含むこと |
| `CALL` | 同 Playbook 内の `tool` を 1 段展開 |

Target は **Semantic（引用符文字列）を推奨**:

```
CLICK "送信ボタン"
TYPE "メール入力" "user@example.com"
```

`role=` / `css=` / `testid=` などの明示 Locator は、Semantic では安定しないと分かったときの最終手段。最初から Locator に落とさない。

## 禁止事項

- 条件分岐・ループ・変数・式
- 実行時の自由探索や、宣言していない Step の追加
- Tool 内の `CALL`（再帰）
- 「ログインできることを確認して」のような曖昧ゴールだけ書いて、経路を Runtime に任せる書き方
- Resolve 結果やセレクタ当てを Skill 側で完結させようとすること

Scenario は **線形**。複数経路が必要なら Scenario を分ける。

## Assertion

検査として意味がある確認を明示する。操作だけで終わらせない。

- 成功時に見える文言・領域: `ASSERT visible` / `ASSERT text`
- 「何をもって合格か」が Report 上で読める粒度にする

## 検証手順（リポジトリ内）

依存関係とブラウザが揃っている前提:

```bash
pnpm build
pnpm --filter @e2e-base/cli exec node ./dist/cli.js run <playbook-path> [--serve-fixtures] [--out <dir>]
```

ローカル fixtures 向けデモと同型なら:

```bash
pnpm demo
```

- 構文エラー → パース失敗。DSL を直す
- 実行失敗 / Assertion 失敗 → Playbook かアプリを直す（Resolve 失敗の根拠は Report の Binding Trace を見る）
- 成功しても、人間が Source 意図・Step・画面・Assertion を見て Qualification する

## Common Mistakes

| やりがち | 代わりに |
|----------|----------|
| スクショだけ残す | `.playbook` を残して再実行可能にする |
| CSS セレクタから書く | Semantic Target で書き、Resolve に任せる |
| 1 Scenario に分岐を詰める | Scenario を分ける |
| ASSERT なしの操作列 | 合格条件を ASSERT で書く |
| 実行時に NL を再解釈させる | 固定した `.playbook` だけを実行する |

## 参照

- `docs/PLAYBOOK_DSL.md` — 構文
- `docs/PRODUCT_DIRECTION.md` — Qualification / Verification、Translation 分離
- `docs/VISION.md` — Semantic / Binding / Trace
- `AGENTS.md` — パッケージ境界と MVP 範囲
