---
name: qualifying-playbook
description: Use when preparing or guiding human Qualification of an e2e_base Playbook—checking that Source intent, executed Steps, Bindings, screenshots, and Assertions together form the intended inspection.
---

# Playbook を Qualification する

## Overview

「この Playbook リビジョンが、意図した検査として振る舞ったか」を人間が判断するための観点。DSL 執筆や run コマンド自体は別 Skill。

## 確認するもの（一続き）

1. 元の検査意図（Source）
2. 実際に実行された Step 列
3. 各 Step の Binding（なぜその要素か）
4. 実行前後の画面（Observation）
5. Assertion の Expected / Actual / 結果

Translator や Skill が一般に正しいことの証明ではない。**この実行において意図どおりだったか**を見る。

## 合格のイメージ

- 宣言していない経路が増えていない
- Semantic Target の解釈が意図とずれていない（Binding 差分に注意）
- Assertion が品質判断に足りる
- Report だけで第三者が追える

## 再認定が必要なとき

- Playbook を変更した
- Binding が大きく変わった
- Assertion が失敗した / 曖昧になった

反復だけの成功確認は Verification。Qualification と混ぜない。

## 参照

- `docs/PRODUCT_DIRECTION.md` — Qualification / Verification
- Report の取得・再実行 → **running-playbook**
