---
name: submitting-inspection-after-impl
description: Use when an agent has finished implementing an app feature and must submit re-runnable e2e_base inspection steps instead of one-off screenshots, or when asked to leave Qualification evidence after implementation.
---

# 実装後に検査手順を提出する

## Overview

実装完了後、「何を確認したか」を再実行可能な `.playbook` + Report として残すユースケース。中身の詳細は単一責務 Skill に委譲する。

## いつ使う

- 機能実装が一段落し、人間へ動作確認を示すとき
- スクショ一枚で済ませず、反復可能な検査を提出するとき

**使わない:** 自由探索だけで目的達成したいとき / Runtime 改修だけが目的のとき

## 手順（組み合わせ）

1. **REQUIRED SUB-SKILL:** **writing-playbook-dsl** — `.playbook` を書く（Semantic Target・ASSERT）
2. **REQUIRED SUB-SKILL:** **running-playbook** — パース通し、実行し Report を残す
3. **REQUIRED SUB-SKILL:** **qualifying-playbook** — 人間が Source / Step / Binding / 画面 / Assertion を照合できる状態にする

```text
実装完了
  → write (.playbook)
  → run (Report)
  → qualify（人間確認）
```

NL→IR Translator は使わない。実行時に自然言語を再解釈しない。
