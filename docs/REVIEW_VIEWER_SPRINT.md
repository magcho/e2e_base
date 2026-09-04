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
| Viewer 改善（照合 UX） | 完成版デザイン / 照合に効く最小改善 | **照合に効く最小改善** | 実行成否と要レビュー分離、Binding 差分の可読化、Before/After 並置、Plan/occurrence 階層、Source 全文、Run 切替リンク |
| Viewer 改善（判断作業） | データ閲覧のまま / 判断フローへ組み直し | **判断フローへ組み直し** | 問い明示、実行結果≠レビュー判断、Span＝レビュー項目、意図どおり/要修正の記録、Observation を証拠の主役に |

## Viewer 照合 UX（追記）

レビュー目的に対する最小改善として、次を入れた。

- ヘッダで **実行 (passed/failed)** と **要レビュー（Binding 変更・未マッピング・未実行）** を分離
- Binding 変更は JSON ではなく `role=… → css=…` と変化フィールド表
- Observation は before / after を横並び
- 中央カラムは Plan（宣言）と Execution（occurrence）を階層表示し、Source/occurrence 件数を明示
- Source は全文のインライン Span とカード一覧を併記
- classic / alt Run をチップで切替（並置ビューではなくリンク）

## Viewer 判断作業 UI（追記）

画面の基本動詞を「見る」から **選ぶ → 照合する → 判定する → 完了する** へ変えた。  
ユーザー向け用語は [REVIEW_GLOSSARY.md](./REVIEW_GLOSSARY.md) に統一する。

- 上部にレビューの問いを明示
- 状態を分離: 実行結果（合格/不合格） / レビュー進捗 / レビュー判定 / 要確認
- 検査意図をレビュー単位（未レビュー・レビュー中・レビュー済・未マッピング）として扱う
- カラム名: 検査意図 / 実行手順 / 証跡
- 選択中の検査意図に対応する実行手順だけを中央に表示
- 色を分離: 青＝選択、薄い青＝対応、オレンジ＝要確認、赤＝不合格・未マッピング
- 証跡を大きくし、実行前/実行後・拡大、アサーション（期待値/実績値）を前面に
- Binding差分は折りたたみの要確認
- 各意図に「適合 / 不適合 / 保留」＋コメント、全件後にレビュー完了（localStorage）
- Qualification / Verification で初期の問い文を切替

未実装（次）: Binding差分時の前回／今回要素サムネイル比較、Qualification 承認ワークフロー本体

## 非目標（意図的にやらなかったこと）

- NL→IR の AI Translation
- Binding DB / 永続ストア
- Qualification 承認 UI
- 分岐 IR / 並列実行
- Playwright Trace Viewer 統合
- 完成版 Viewer デザイン
