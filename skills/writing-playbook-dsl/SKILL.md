---
name: writing-playbook-dsl
description: Use when drafting or editing a .playbook file, choosing Semantic Targets, Step vocabulary, ASSERT placement, or Tool/CALL structure for e2e_base.
---

# Playbook DSL を書く

## Overview

`.playbook` の**書き方だけ**を扱う。実行・Qualification・提出フローは別 Skill。

## 出力

- 拡張子: `*.playbook`（または `*.pb`）
- 正: `docs/PLAYBOOK_DSL.md`
- 手本: `examples/submit-form.playbook`

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

## 語彙

| キーワード | 用途 |
|------------|------|
| `NAVIGATE` | URL へ遷移 |
| `CLICK` | クリック |
| `TYPE` | 入力（既存値クリア前提） |
| `ASSERT visible` / `ASSERT text` | 合格条件 |
| `CALL` | 同 Playbook 内 `tool` の 1 段展開 |

Target は Semantic（`"送信ボタン"`）を推奨。`role=` / `css=` / `testid=` は最終手段。

## 制約

- Scenario は線形。分岐・ループ・変数なし
- Tool 内 `CALL` 禁止
- 曖昧ゴールだけ書いて経路を Runtime に任せない
- Resolve / セレクタ当てをこの Skill で完結させない
- 操作列だけで終わらせず ASSERT を置く

## やりがち

| やりがち | 代わりに |
|----------|----------|
| CSS から書く | Semantic Target |
| 1 Scenario に分岐 | Scenario を分ける |
| ASSERT なし | 合格条件を書く |
