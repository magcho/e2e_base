# VISION — Web操作実行基盤の構想

## 一言で言うと

「何をするか（Specification）」から「画面上の何を操作するか（Resolution）」を経て、「実行・観測・評価・証跡・報告」までを、監査可能な一本のパイプラインとして扱う実行基盤。

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

## 設計原則

| 原則 | 意味 |
|------|------|
| Translation ≠ Resolution | 「送信する」と「どのボタンか」を混ぜない |
| Playbook は中間 IR | テキスト構文と内部 AST/モデルを分離する |
| Scenario は最小独立単位 | TestCase 階層や `beforeEach` を置かない |
| Tool は名前付き Step 列 | 再帰禁止・ローカルスコープ・失敗は伝播 |
| Assertion ≠ Evaluator | 宣言（期待）と判定ロジックを分離 |
| Observation ≠ Evidence | 生の観測と、報告用に束ねた証跡を分離 |
| Provenance | Stable ID と Binding により「なぜその要素か」を辿れる |

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
