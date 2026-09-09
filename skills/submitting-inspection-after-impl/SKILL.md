---
name: submitting-inspection-after-impl
description: >
  Use when implementation of an app feature is done and the agent must leave re-runnable
  e2e_base inspection evidence (.playbook + Report) for a human instead of one-off
  screenshots, or when asked to submit Qualification-ready verification after coding.
  Not for free-form browser exploration or Runtime-only refactors.
---

# 実装後に検査手順を提出する

## Overview

実装完了後に `.playbook` + Report を残すユースケース。詳細は primitive に委譲する。

## 使わないとき

- 自由探索だけで目的達成したい
- Runtime / Resolver 改修だけが目的

## 手順

Progress:

```
- [ ] 1. write — REQUIRED SUB-SKILL: writing-playbook-dsl
- [ ] 2. run — REQUIRED SUB-SKILL: running-playbook（Report を残す）
- [ ] 3. qualify 準備 — REQUIRED SUB-SKILL: qualifying-playbook（人間が照合できる状態にする）
```

NL→IR Translator は使わない。実行時に自然言語を再解釈しない。
