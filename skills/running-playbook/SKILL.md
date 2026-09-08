---
name: running-playbook
description: Use when executing an e2e_base .playbook locally, checking parse success, choosing run flags such as --serve-fixtures, or interpreting runtime / Assertion / Resolve failures from a report.
---

# Playbook を実行する

## Overview

既存 Runtime（`e2e-base run`）で `.playbook` を走らせ、形式エラーと実行結果を切り分ける。DSL の書き方や Qualification 判断は別 Skill。

## 前提

- `pnpm build` 済み
- デモ / fixtures なら Chromium インストール済み（`pnpm playwright:install`）

## 実行

```bash
pnpm --filter @e2e-base/cli exec node ./dist/cli.js run <playbook-path> [--serve-fixtures] [--out <dir>]
```

ローカル fixtures デモ:

```bash
pnpm demo
```

形式チェックは新規 Validator を増やさない。`parsePlaybook`（run 入口）成功 = 形式 OK。

## 結果の切り分け

| 症状 | 見る場所 | 次の一手 |
|------|----------|----------|
| 構文エラー | CLI のパース失敗 | DSL を直す → **writing-playbook-dsl** |
| Resolve 失敗 | Report の Binding Trace | Target 記述かアプリ側を直す |
| Assertion 失敗 | Expected / Actual | ASSERT かアプリを直す |
| 成功 | Report HTML | 意味確認は **qualifying-playbook** |

Runtime に NL 再解釈や自由探索を足さない。
