---
name: revising-playbook-for-requalification
description: >
  Use when an existing e2e_base Playbook failed Qualification or Verification, Bindings
  drifted, Assertions are weak or wrong, or scenarios must be edited and re-qualified
  after a failed or ambiguous report. Not for first-time submission after greenfield impl
  (use submitting-inspection-after-impl).
---

# Playbook を直して再 Qualification する

## Overview

既存 `.playbook` の修正と再認定。詳細は primitive に委譲する。

## 手順

Progress:

```
- [ ] 1. Report から切り分け — REQUIRED SUB-SKILL: running-playbook
- [ ] 2. Scenario / Target / ASSERT を直す — REQUIRED SUB-SKILL: writing-playbook-dsl
- [ ] 3. 再実行して Report 更新 — REQUIRED SUB-SKILL: running-playbook
- [ ] 4. 変更リビジョンを人間が再確認 — REQUIRED SUB-SKILL: qualifying-playbook
```

分岐で経路を隠さない。別経路は Scenario を分ける。Playbook 変更後は Verification 成功だけでは不十分（再 Qualification）。
