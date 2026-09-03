# PLAYBOOK_DSL — MVP 構文

テキスト構文と内部モデルは分離する。本ファイルは **テキスト構文** のみを定義する。

## ファイル拡張子

`.playbook`（推奨）または `.pb`

## 基本構造

```
playbook "demo"

tool fill_credentials
  TYPE "メール入力欄" "user@example.com"
  TYPE "パスワード入力欄" "secret"
end

scenario "ログインして送信"
  NAVIGATE "http://127.0.0.1:4173/"
  CALL fill_credentials
  CLICK "送信ボタン"
  ASSERT visible "成功メッセージ"
  ASSERT text "成功メッセージ" "送信しました"
end
```

## 文法（EBNF 風）

```
playbook     := 'playbook' string NL block*
block        := tool_def | scenario_def
tool_def     := 'tool' ident NL step* 'end' NL
scenario_def := 'scenario' string NL step* 'end' NL
step         := navigate | click | type | assert | call
navigate     := 'NAVIGATE' string
click        := 'CLICK' target
type         := 'TYPE' target string
assert       := 'ASSERT' 'visible' target
              | 'ASSERT' 'text' target string
call         := 'CALL' ident
target       := string                      # Semantic Target（引用符文字列）
              | locator
locator      := 'role=' ident ('name=' string)?
              | 'css=' string
              | 'text=' string
              | 'testid=' string
string       := '"' [^"]* '"'
ident        := [A-Za-z_][A-Za-z0-9_]*
```

## 操作語彙（MVP）

| キーワード | 意味 |
|------------|------|
| `NAVIGATE` | URL へ遷移 |
| `CLICK` | ターゲットをクリック |
| `TYPE` | ターゲットにテキスト入力（既存値はクリア） |
| `ASSERT visible` | ターゲットが表示されていること |
| `ASSERT text` | ターゲットのテキストが期待値を含むこと |
| `CALL` | 名前付き Tool をインライン展開 |

## Target の書き方

### Semantic（推奨）

```
CLICK "送信ボタン"
TYPE "名前入力" "magcho"
```

内部では `SemanticTarget { description: "送信ボタン" }` となる。

### 明示 Locator（デバッグ・フォールバック用）

```
CLICK role=button name="送信"
CLICK css="#submit"
CLICK text="送信する"
CLICK testid="submit-btn"
```

明示 Locator は Resolution をスキップし、`strategy: explicit_locator` の Binding を合成する。

## Tool ルール

1. `tool` は Scenario から `CALL` でのみ利用する
2. Tool 内に `CALL` を書いてはならない（再帰禁止）
3. Tool 引数は MVP では未対応（将来 `CALL fill_credentials email=...`）
4. ローカルスコープ: Tool 名は Playbook 内で一意

## コメントと空白

- `#` から行末までコメント
- 空行は無視
- インデントは可読性のため任意（パーサはキーワード先頭を見る）

## パース結果

パーサは Stable ID 付きの `Playbook` IR を返す。構文エラーは行番号付きで報告する。

## 非対応（MVP 外）

- 変数・式・条件分岐・ループ
- `beforeEach` / 共有セットアップブロック
- ネスト Scenario / TestCase
- 複数ファイル import
- スクリーンショット指示の明示キーワード（Observation は実行器が自動取得）
