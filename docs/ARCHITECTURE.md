# ARCHITECTURE — レイヤーとコンポーネント境界

## 全体像

```
┌─────────────┐
│  Playbook   │  テキスト DSL（人間編集）
└──────┬──────┘
       │ parse (@e2e-base/core)
       ▼
┌─────────────┐
│ Scenario IR │  AST / ドメインモデル + Stable ID
└──────┬──────┘
       │ resolve (@e2e-base/resolver)
       ▼
┌─────────────┐
│ Bound Steps │  Binding + Provenance
└──────┬──────┘
       │ execute (@e2e-base/executor)
       ▼
┌──────────────────────────┐
│ Observation / StepResult │  screenshot, DOM 要約, pass/fail
└──────┬───────────────────┘
       │ report (@e2e-base/reporter)
       ▼
┌─────────────┐
│ HTML Report │  Trace 可視化
└─────────────┘

CLI (@e2e-base/cli) が上記をオーケストレーションする。
```

## パッケージ境界

| パッケージ | 責務 | 依存してよいもの |
|------------|------|------------------|
| `@e2e-base/core` | IR、型、パーサ、ID 生成、実行結果型 | なし（純粋） |
| `@e2e-base/resolver` | Semantic → Locator Binding | `core` |
| `@e2e-base/executor` | Playwright による Bound Step 実行 | `core` |
| `@e2e-base/reporter` | StepResult → HTML | `core` |
| `@e2e-base/cli` | エントリ・配線 | 上記すべて |

### 境界ルール

1. **core は Playwright / OpenAI に依存しない**
2. **executor は Resolution を行わない**（渡された Binding のみ使う）
3. **resolver は副作用あるページ操作をしない**（候補収集のための読み取りは可）
4. **reporter は再実行しない**（入力は StepResult / Evidence のみ）
5. **cli だけが I/O とポリシー（AI キー有無など）を決定する**

## 実行シーケンス（MVP）

1. CLI が Playbook ファイルを読む
2. `parsePlaybook` → `Playbook`（Scenario / Tool 定義）
3. Scenario を選び、ToolCall を展開（非再帰）
4. 各 Step について:
   - Target が Semantic なら Resolver で Binding
   - BoundStep を Executor に渡す
   - Observation（screenshot 等）を取得
   - Assertion があれば Evaluator で判定 → StepResult
5. 全 StepResult を Reporter に渡し HTML を出力

## Progressive Resolution（MVP 実装）

```
1. Deterministic heuristic
   - accessible name 完全一致
   - role + name
   - ラベル近傍テキスト（簡易）
2. AI-assisted resolver（OPENAI_API_KEY がある場合）
   - 候補一覧 + semantic を渡し、候補 ID を選ばせる
3. 失敗時は StepResult=failed + 根拠をレポート
```

Binding 永続化はメモリ内（実行スコープ）のみ。ドメイン型としては `Binding` を最初から定義する。

## Observation と Evidence

| 概念 | MVP での実体 |
|------|----------------|
| Observation | screenshot パス、URL、可視テキスト要約、タイムスタンプ |
| Evidence | Scenario 単位で Observation + Binding Trace + StepResult を束ねたもの |
| Report | Evidence を HTML にレンダリングしたもの |

## 拡張ポイント（後続）

- Translation サービス（NL → Playbook）
- Binding Store（セレクタ学習・再利用）
- Auth / Session 抽象
- Plugin（カスタム Action / Evaluator）
