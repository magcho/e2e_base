---
name: running-playbook
description: >
  Use when running e2e_base via `e2e-base run` / `pnpm demo`, choosing --serve-fixtures
  or --out, diagnosing parse errors, Resolve failures, Assertion failures, or reading
  Binding Trace in an HTML report. Do not use when only drafting DSL with no execution.
---

# Playbook を実行する

## Overview

Runtime で走らせ、形式エラーと実行結果を切り分ける。DSL 修正は **writing-playbook-dsl**、意味の最終判断は **qualifying-playbook**。

## チェックリスト

```
- [ ] pnpm build（必要なら playwright:install）
- [ ] e2e-base run <playbook> [--serve-fixtures] [--out <dir>]
- [ ] 失敗なら下表で切り分け
- [ ] 成功なら Report パスを残す
```

```bash
pnpm --filter @e2e-base/cli exec node ./dist/cli.js run <playbook-path> [--serve-fixtures] [--out <dir>]
```

fixtures デモ: `pnpm demo`

形式チェック用の新規 Validator は増やさない。`parsePlaybook`（run 入口）成功 = 形式 OK。

## 切り分け

| 症状 | 見る場所 | 次 |
|------|----------|-----|
| 構文エラー | CLI パース失敗 | **writing-playbook-dsl** |
| Resolve 失敗 / クリック timeout | Report の Binding・候補 | Target か画面状態を直す → write |
| Assertion 失敗 | Expected / Actual | ASSERT かアプリ |
| 成功 | `report.html` | **qualifying-playbook** |

## Gotchas

- Binding の `name` が CSS `text-transform` で大文字化されていると、厳密一致ロケータが外れることがある。Report の strategy / locator を信じる
- `getByRole` の部分一致で別リンクを踏むと、後続 Step が「候補はあるが不可視」で落ちやすい。先の Binding を疑う
- ライブサイトが 403 のときは `--serve-fixtures` と fixtures 導線へ切り替える

Runtime に NL 再解釈や自由探索を足さない。
