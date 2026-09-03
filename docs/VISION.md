# VISION — Web操作実行基盤の構想

## 一言で言うと

「何をするか（Specification）」から「画面上の何を操作するか（Resolution）」を経て、「実行・観測・評価・証跡・報告」までを、人間が追跡・確認できる一本のパイプラインとして扱う実行基盤。

プロダクトとしては、AI が自由に目的達成を試みるブラウザエージェントではなく、**人間または AI が作った固定済みの検査手順を制約付きで実行し、その手順と結果の対応を人間が確認・反復できるランタイム**を目指す。技術 MVP 後に合意した利用モデル、Qualification / Verification、3 カラム Review Viewer の詳細は [PRODUCT_DIRECTION.md](./PRODUCT_DIRECTION.md) を参照する。

## 中心フロー

```
Specification
  → Translation / Refinement
  → Resolution
  → Execution
  → Observation
  → Evaluation
  → Evidence
  → Report
```

MVP では **Translation（自然言語→Playbook）を後回し**にし、人手またはテンプレートで書いた Playbook を入口とする。仮説検証の焦点は **Semantic Target の Resolution と証跡** にある。

将来も Translation と Runtime は別の機構として扱う。自然言語、DSL、TypeScript などの入力は Canonical Playbook IR へ変換し、反復実行時は Git に固定された IR を直接実行する。元の自然言語を実行のたびに再解釈しない。

## 設計原則

| 原則 | 意味 |
|------|------|
| Translation ≠ Resolution | 「送信する」と「どのボタンか」を混ぜない |
| Playbook は中間 IR | テキスト構文と内部 AST/モデルを分離する |
| Scenario は最小独立単位 | TestCase 階層や `beforeEach` を置かない |
| IR は原則として線形 | 条件分岐や自由な実行時計画変更を持ち込まない |
| Tool は名前付き Step 列 | 再帰禁止・ローカルスコープ・失敗は伝播 |
| Assertion ≠ Evaluator | 宣言（期待）と判定ロジックを分離 |
| Observation ≠ Evidence | 生の観測と、報告用に束ねた証跡を分離 |
| Provenance | Stable ID と Binding により「なぜその要素か」を辿れる |

## 人間による確認

人間が IR の全フィールドを静的に証明することは必須としない。元の入力、生成された実行計画、実際の Step、選択された Binding、実行前後の画面、Assertion の結果を一続きに確認し、その Playbook リビジョンが意図した検査として振る舞ったかを判断する。

初回または変更時に検査手順自体を確認する **Qualification** と、確認済み IR を繰り返し実行する **Verification** を区別する。

## 重要概念

- **Semantic Target** — 「送信ボタン」のような人間寄りの指示。Locator ではない。
- **Binding** — Semantic Target を具体的 Locator / Accessibility ノードへ結び付けた結果。戦略・信頼度・根拠を持つ。
- **Progressive Resolution** — ヒューリスティック → AI → 人手確認、など段階的に解像度を上げる。
- **Provenance / Traceability** — Step・Target・Binding・結果に Stable ID を付与し、レポートで辿れる。

## MVP で検証する最重要仮説

> 「送信ボタン」のような Semantic Target を AI（または同等の Resolver）で Resolve し、監査可能な形で実行・証跡を残せるか。

成功条件のイメージ:

1. Playbook に Semantic Target を書ける
2. Resolver が Binding（戦略・根拠付き）を返す
3. Executor が Binding に従って操作する
4. HTML Report に Resolution 経緯と Screenshot が残る
5. API キー無しでも heuristic でデモが通る

## 非目標（MVP）

- NL → Playbook の自動 Translation
- Binding の永続ストア
- API Action / Auth 抽象化
- Plugin エコシステム完成
- 大規模並列実行・クラウドランナー

## 位置づけ

本リポジトリ `e2e_base` は、上記パイプラインの **実行核（Parse → Resolve → Execute → Observe → Report）** を先に固めるための MVP である。将来の Translation 層や Binding 永続化は、この核の上に載せる。
