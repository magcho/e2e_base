---
name: qualifying-playbook
description: >
  Use when a human must Qualification-review an e2e_base Playbook run—comparing Source
  intent, executed Steps, Bindings, screenshots, and Assertions—or when deciding if
  re-qualification is needed after Playbook or Binding changes. Not for writing DSL or
  CLI invocation alone.
---

# Playbook を Qualification する

## Overview

「この Playbook リビジョンが、この実行で意図した検査だったか」を人間が判断する観点。執筆は **writing-playbook-dsl**、再実行は **running-playbook**。

## 照合チェックリスト

```
- [ ] Source（検査意図）が読める
- [ ] 実行された Step 列が意図の経路と一致
- [ ] Binding（なぜその要素か）が妥当
- [ ] Observation（画面）が操作を裏付ける
- [ ] Assertion の Expected / Actual / 結果が品質判断に足りる
```

Translator / Skill が一般に正しいことの証明ではない。

## 合格の目安

- 宣言外の経路が増えていない
- Semantic の解釈が意図とずれていない（Binding 差分に注意）
- Report だけで第三者が追える

## Qualification が再度必要なとき

- Playbook を変えた
- Binding が大きく変わった
- Assertion が失敗した / 曖昧になった

反復だけの成否確認は Verification。混ぜない。

詳細方針: 必要なら **Read** `docs/PRODUCT_DIRECTION.md` の Qualification / Verification 節。
