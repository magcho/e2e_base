---
name: revising-playbook-for-requalification
description: Use when an existing e2e_base Playbook failed Qualification or Verification, Binding drifted, Assertions are insufficient, or the scenario must be edited and re-qualified.
---

# Playbook を直して再 Qualification する

## Overview

既存 `.playbook` の修正と再認定のユースケース。書き方・実行・判定基準は各 primitive Skill に委譲する。

## いつ使う

- Qualification で意図ずれが分かった
- Verification で Assertion 失敗 / Binding 変化が気になる
- 検査範囲や合格条件を足す・削る

## 手順（組み合わせ）

1. 失敗理由を Report から切り分ける → **running-playbook**
2. Scenario / Target / ASSERT を直す → **writing-playbook-dsl**
3. 再実行して Report を更新 → **running-playbook**
4. 変更後リビジョンを人間が再確認 → **qualifying-playbook**

分岐を足して経路を隠さない。別経路は Scenario を分ける。

Playbook を変えたら Verification の成功だけでは不十分。再 Qualification が必要。
