# Review Viewer 縦切り — 仕様判断ログ

記録日: 2026-09-04  
対象スプリント: Source / Plan / Execution / Observation を一続きに確認できる最小 Review Viewer

確認待ちを避け、**最小・可逆**な選択をした。大きな抽象化は入れていない。

## 判断一覧

| 論点 | 選択肢 | 採用 | 理由 |
|------|--------|------|------|
| 型の置き場 | ScenarioResult を置換 / 加算拡張 | **加算拡張** | 既存 `pnpm demo` を壊さない。PRODUCT_DIRECTION も「一気に型へ追加しない」と明記 |
| Source 位置 | 行・列 Position / 文字 offset | **文字 offset** | NL 短文の縦切りには十分。DSL 行単位が必要になったら拡張 |
| Plan Node ID | 新規 ID / Scenario Step ID | **Scenario Step ID** | CALL を Plan、展開後を occurrence とするのに足りる |
| occurrencePath | 実行インデックスのみ / 構造化パス | **構造化パス**（`scn/stp1:CALL/fill_contact#0/TYPE@0`） | 同一 Tool 複数呼び出しを区別できる |
| Binding 変更検知 | Binding Store / 前回 Result 比較 | **前回 Result（classic 実行）と比較** | DB は非目標。fixture 間比較で再現可能 |
| Binding 変更時の実行 | 停止 / 継続 | **継続**（PRODUCT_DIRECTION 決定 15） | Assertion 失敗とは別シグナル |
| 失敗後の未実行 | 結果から省略 / skipped で残す | **skipped で残す** | Viewer で未実行を隠さない |
| 未マッピング Plan | Playbook 外の合成ノード | **ReviewBundle に合成 PlanNode を 1 つ追加** | Translator 欠落の見え方をデモするため。IR 本体には入れない |
| 既存 HTML Report | 削除 / 併存 | **併存** | `writeHtmlReport` は互換、`writeReviewHtmlReport` が 3 カラム |

## 非目標（意図的にやらなかったこと）

- NL→IR の AI Translation
- Binding DB / 永続ストア
- Qualification 承認 UI
- 分岐 IR / 並列実行
- Playwright Trace Viewer 統合
- 完成版 Viewer デザイン
