---
name: writing-playbook-dsl
description: >
  Use when drafting or editing an e2e_base .playbook / .pb file, choosing Semantic
  Targets vs locators, placing ASSERT steps, or structuring tool/CALL — including
  after Resolve ambiguity, duplicate "Add to cart" labels, or linear-scenario constraints.
  Do not use for running the CLI or human Qualification judgment alone.
---

# Playbook DSL を書く

## Overview

`.playbook` の**書き方だけ**。実行は **running-playbook**、認定観点は **qualifying-playbook**。

## 最小形

手本: `examples/submit-form.playbook`

```
playbook "feature-name"

scenario "何を確認するか一文で"
  NAVIGATE "http://127.0.0.1:4173/"
  TYPE "名前入力" "magcho"
  CLICK "送信ボタン"
  ASSERT visible "成功メッセージ"
end
```

語彙の正本・EBNF・非対応一覧が必要なら **Read** `docs/PLAYBOOK_DSL.md`（この Skill に全文を複製しない）。

## デフォルト

- Target は Semantic（`"送信ボタン"`）。`role=` / `css=` / `testid=` は最終手段
- Scenario は線形。別経路は Scenario を分ける
- 操作だけで終わらせず ASSERT を置く
- Tool は Step 列の再利用。Tool 内 `CALL` 禁止

## Gotchas

- 一覧に同名 `Add to cart` / `View Product` が複数あるときは、曖昧な Semantic のまま押さない。商品詳細など一意になる画面へ進んでから追加する
- アコーディオン配下のリンクは、開いていないとクリック待ちで落ちる。開く Step を明示するか、カテゴリ URL を `NAVIGATE` する
- `"Men"` のような短い名前は他ラベルに部分一致しやすい。実ラベル（大文字小文字・アイコン付き）を意識し、必要ならより具体的な Target にする
- ヘッダ検索とサイト内検索が別物のサイトでは、検査意図どおりの検索 UI を Target に書く
- ライブ検索が WAF/403 のときは fixtures で同等導線を再現し、Source コメントに制約を残す

## やりがち

| やりがち | 代わりに |
|----------|----------|
| CSS から書く | Semantic Target |
| 分岐を 1 Scenario に詰める | Scenario を分ける |
| ASSERT なし | 合格条件を書く |
| 曖昧ゴールだけ書いて探索を Runtime に任せる | 線形 Step を宣言する |
