# PRODUCT_DIRECTION — プロダクト方針とレビューライフサイクル

## 文書の位置づけ

- 状態: 現時点の合意（実装詳細は未決）
- 記録日: 2026-09-04
- 対象: `e2e_base` の技術 MVP 完了後に行ったプロダクト壁打ち

本書は、現在の実装を直ちに変更するための仕様書ではない。技術 MVP の先で何をプロダクト価値とし、今後の設計・実装をどの方向へ進めるかを、将来の開発者とエージェントが参照できる形で記録する。

既存実装の仕様は [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)、現在のパッケージ境界は [ARCHITECTURE.md](./ARCHITECTURE.md) を正とする。本書と現行実装に差がある場合、本書は将来方向を示すものであり、差を暗黙に実装済みと扱ってはならない。

## 1. プロダクトの中心的な目的

`e2e_base` が最適化するのは、AI が自由に Web 操作を成功させることではない。

> 固定された検査手順を制約された方法で実行し、その手順と結果の対応を人間が理解・確認でき、同じ検査を反復できる状態を作る。

代表的な利用場面は、AI エージェントにアプリケーション開発を依頼した後、そのエージェントが「何を作り、どの動作を確認したか」を人間へ示す場面である。エージェントが一回限りのスクリーンショットを任意に作るのではなく、再実行可能な検査手順を提出し、ランタイムが実行結果をレポートする。

同じ実行核は QA・テスターにも利用できる。QA は反復的な打鍵そのものではなく、次の責任に集中できる。

- どの検査を行うべきか
- 検査手順が意図に合っているか
- Assertion が品質判断に十分か
- 検査結果から何を判断するか

## 2. 一般的なブラウザエージェントとの違い

一般的なブラウザエージェントは、与えられた目的の達成を優先する。例えば「ログインできることを確認する」という指示に対し、画面を探索し、必要に応じて別ページへ移動し、操作方法を途中で組み替えて最終状態へ到達しようとする。

これは業務遂行には有用だが、検査では「毎回どの経路で何を確認したか」が変わり得る。

`e2e_base` は、固定した Playbook の範囲内でのみ実行する。Semantic Target の具体的な要素への解決には一定の柔軟性を持たせるが、宣言されていない Step や経路を実行時に追加して目的達成を試みるものにはしない。

このプロダクトの中核は、Playwright の完全な決定性と自由な AI ブラウザ操作の中間にある、**制約された意味的実行**である。

## 3. システムを二つの機構に分ける

システムは、入力表現を実行可能な中間形式へ変換する機構と、その中間形式を実行して結果を報告する機構に分ける。

```text
Source Representation
  Natural Language / DSL / TypeScript / Playwright など
                         │
                         │ Translation / Compilation / Import
                         ▼
                 Canonical Playbook IR
                         │
                         │ Resolution / Execution / Evaluation
                         ▼
                  Execution Result
                         │
                         │ Rendering
                         ▼
                    Human Report
```

### 3.1 Translation 側

自然言語、独自 DSL、TypeScript API などを Canonical Playbook IR に変換する。入力形式ごとに変換の性質と保証は異なる。

| 入力 | 変換の性質 | 想定する保証 |
|------|------------|--------------|
| Playbook DSL | Compile | 制約された文法内では決定的 |
| TypeScript Builder API | Build / Compile | Builder API の範囲内では決定的 |
| 自然言語 | Translate / Generate | 推論を含むため、実行を通じた人間の確認が必要 |
| 一般的な Playwright コード | Import / Analyze / Record | 任意の JavaScript を完全かつ静的に変換できるとは限らない |

Playwright コードは条件分岐、ループ、外部 I/O、任意の JavaScript を含められる。このため、Playwright から IR への変換は、対応する構文の制限、Builder API の利用、または一回の実行で観測した操作列の記録など、保証範囲を明示する必要がある。

### 3.2 Runtime 側

Canonical Playbook IR を入力として、次を行う。

1. Step を順番に解釈する
2. 必要な Target を現在の画面状態に対して Resolve する
3. Binding に基づいて操作する
4. 実行前後の状態を Observation として取得する
5. Assertion を Evaluation する
6. Execution Result を生成する
7. 人間向け Report をレンダリングする

実行時に元の自然言語を再解釈しない。同じ検査を反復するときは、Git に固定された Canonical Playbook IR を直接実行する。

## 4. Canonical Playbook IR の位置づけ

Canonical Playbook IR は、ランタイムが実行する正本である。`.playbook` テキストは IR そのものではなく、IR を生成または表示する一つの表現として扱う。

想定する運用は次のとおり。

1. 人間または AI が Source Representation を作る
2. Translator / Compiler が Canonical Playbook IR を生成する
3. Canonical Playbook IR を Git にコミットする
4. 人間が実行計画と初回実行結果を確認する
5. 確認済みの IR を以後の反復実行に利用する

自然言語や Translator のモデル・バージョンが変わっても、コミット済み IR は自動的には変わらない。再翻訳で IR が変わる場合は、変更として確認する。

## 5. 人間による確認は実行を通じて行う

人間が Canonical Playbook IR の全フィールドを静的に読み、Translator の正しさを事前証明することは、必須の利用フローにしない。

人間は次を合わせて見て、生成された Playbook が意図した検査になっているかを確認する。

- 元の入力・テスト意図
- 人間向けに表示した実行計画
- 実際に実行された Step 列
- 各 Step で選択された対象
- 実行前後の画面
- Assertion の Expected / Actual / 結果

ここで確認するのは「Translator が一般に正しい」ことではなく、**この Playbook リビジョンが、この実行において意図した検査として振る舞ったこと**である。

この考え方を成立させるため、Playbook IR は原則として線形に保つ。

### 5.1 分岐を原則として認めない

検査手順の IR には、実行時に隠れた経路を作る条件分岐や自由な計画変更を原則として導入しない。

- 複数の条件を確認したい場合は Scenario を分ける
- Tool は再利用可能な Step 列として展開する
- 失敗時の後続 Step は `skipped` として可視化する
- Retry は分岐ではなく同一 Step の Attempt 履歴として扱う

一回の実行で通らない分岐があると、レポートを見ても IR の未実行部分を確認できない。線形であることは実装を単純にするだけでなく、実行を通じた確認の信頼性を高める。

## 6. Qualification と Verification

同じ Runtime と Report を、異なる目的の二つのフェーズで利用する。

### 6.1 Qualification — 検査手順を認定する

初回または Playbook 変更時に、生成した Playbook IR を実行する。人間は Source、Plan、実際の操作、Assertion、画面状態を確認し、「意図した検査手順になっているか」を判断する。

確認できた Playbook リビジョンを、反復利用可能な検査手順として扱う。

### 6.2 Verification — 認定済み手順で反復検証する

Git に固定した Playbook IR を繰り返し実行し、対象アプリケーションの現在の状態を検証する。毎回 Translation を行わず、通常は成功・失敗と前回からの重要な変化を確認する。

人間による詳細確認が必要になる代表例は次のとおり。

- Playbook IR が変更された
- Binding が前回から変わった
- Target が曖昧になった
- 実行経路または実行ポリシーが変わった
- Assertion が失敗した

アプリケーション自体の変更は、自動的に Playbook の再認定理由とはしない。同じ検査を変更後のアプリケーションへ反復することが Verification の目的だからである。

Qualification の承認操作や承認記録をプロダクト機能として必須にするかは未決である。Git の PR レビューを認定として利用する方法も候補に含む。

## 7. Execution Result、Report、Artifact の役割

すべてを強い意味の「証跡」と呼ばず、役割を分ける。

| 概念 | 役割 |
|------|------|
| Execution Result | Runtime が生成する最小限の構造化された実行結果 |
| Report | Execution Result を人間向けに表示したもの |
| Observation | Step 実行時に取得した状態 |
| Artifact | Screenshot などの補助資料 |
| Evidence | 判断を裏付ける Observation / Artifact の総称 |

Execution Result を構造化する主目的は、将来 AI に再投入することではない。Runner と Reporter を分離し、同じ結果を HTML、Markdown、CLI などで表現できるようにすることである。

通常の Execution Result を巨大なデバッグログにはしない。DOM 全体、全ネットワーク通信、完全な AI プロンプトなどは、具体的な用途が生じた場合に診断用 Trace として別に扱う。

署名、改ざん検知、強い隔離実行なども現段階の中核要件にはしない。必要な信頼レベルが定義された段階で拡張を検討する。

## 8. 3 カラムの Review Viewer

Qualification と Verification の中心 UI として、Cypress のタイムトラベル表示に着想を得た 3 カラムの Review Viewer を構想する。

| 左: Source | 中: Plan / Trace | 右: Observation |
|------------|------------------|------------------|
| 人間または AI が入力した意図 | 生成・展開・実行された検査手順 | ブラウザで実際に起きたこと |
| 自然言語、DSL、TypeScript など | Plan Node、Step Execution、状態 | Before / After / Assertion / Error |
| Source Span と対応状況 | Tool 展開、Binding、Expected | 対象要素の強調、Actual、画面 |

### 8.1 基本操作

- 左の Source Span を選ぶと、対応する複数の Plan Node をハイライトする
- 中の Plan Node / Step Execution を選ぶと、対応する Source Span と Observation を表示する
- 右では Step 実行前後の画面を切り替え、操作対象を強調表示する
- ホバーは一時プレビュー、クリックは選択状態の固定に利用する
- キーボードで前後の Step、Before / After を移動できるようにする

### 8.2 中央は DSL 表示だけに限定しない

中央カラムは DSL 風に表示できるが、役割は単なる DSL Viewer ではない。次を重ねて表示する Execution Plan / Trace とする。

- 宣言された Playbook Step
- Tool 展開後の実行 Step
- 実行状態（passed / failed / error / skipped）
- 実際に利用した Binding
- Assertion の Expected / Actual
- Retry がある場合の Attempt

Tool 呼び出しは、構造表示と展開表示の両方を確認できるようにする。同じ Tool が複数回呼ばれる場合、定義上の Step ID と実行時の occurrence を区別する。

### 8.3 Step ではなく状態遷移として表示する

操作 Step は、実行前状態から実行後状態への遷移である。クリック後の Screenshot 一枚だけでは操作対象を確認できないため、少なくとも次を扱う。

- `before`: 操作直前。対象要素を強調する
- `after`: 操作直後
- `assertion`: Assertion 対象、Expected、Actual
- `error`: エラー発生時の状態

右カラムは Screenshot 専用ではなく Observation 表示とする。将来 URL、Download、Dialog など非画像の観測を扱える余地を残す。

### 8.4 正しい対応だけでなく欠落を可視化する

Source Map は一対一とは限らない。一つの自然文が複数 Step になり、複数の Source Span が一つの Plan Node に対応することもある。

Viewer は対応がある箇所だけでなく、次を強く表示する。

- どの Plan Node にも対応していない Source Span
- どの Source にも対応していない生成 Plan Node
- 実行されなかった Plan Node
- Resolve できなかった Step
- 前回から Binding が変わった Step

マッピング済み部分だけを表示すると、Translator が入力の一部を欠落させた場合に気づけない。Mapping Coverage は Qualification の重要な確認項目である。

## 9. Source Map の概念モデル

Viewer が直接 Source から Screenshot へ結び付けるのではなく、次の連鎖を辿る。

```text
SourceDocument
    └─ SourceSpan[]
           ↕ many-to-many
       PlanNode[]
           ↕ one-to-many
       StepExecution[]
           └─ Observation[]
```

概念型のたたき台は次のとおり。現時点では実装型として確定しない。

```ts
type SourceDocument = {
  id: string;
  kind: "natural-language" | "dsl" | "typescript" | "playwright";
  content: string;
};

type SourceReference = {
  sourceDocumentId: string;
  start: Position;
  end: Position;
};

type PlanNode = {
  id: string;
  sourceReferences: SourceReference[];
  step: Step;
};

type StepExecution = {
  id: string;
  planNodeId: string;
  occurrencePath: string;
  status: StepStatus;
  binding?: Binding;
  evaluation?: Evaluation;
  observations: Observation[];
};
```

## 10. Binding キャッシュの意味

Binding キャッシュは単なる高速化ではなく、人間が妥当と確認した解釈を次回も優先するために利用できる。

ただし Execution Result と Binding Store は分ける。

- Execution Result: 今回、実際にどの Binding が利用されたか
- Binding Store: 次回、どの Binding を優先するか

候補となる実行方針は次のとおり。

| 方針 | 挙動 |
|------|------|
| Resolve always | 毎回 Semantic Target を解決する |
| Prefer cached | 過去の Binding を検証し、使えなければ再 Resolve する |
| Pinned | 固定 Binding が成立しなければ失敗する |

同じ IR を実行すること、同じ Binding を利用すること、同じ Assertion で評価することは別の保証である。反復性という一語でまとめず、何を固定するかを Execution Policy として明示する。

## 11. 現時点での決定事項

1. プロダクトの中心は、AI エージェントが安全かつ検証可能に Web 操作するための実行ランタイムとする
2. 目的達成のために自由に探索するブラウザエージェントではなく、固定された検査手順を制約付きで実行する
3. Translation 系と Runtime 系を別の機構として扱う
4. Canonical Playbook IR を実行上の正本とし、Git で固定・反復利用する
5. Runtime は反復実行時に元の自然言語を再解釈しない
6. 人間は IR 全体を静的に証明するのではなく、Source、Plan、Execution、Observation を合わせて検査手順を確認する
7. Playbook IR は原則として線形とし、条件分岐や自由な実行時計画変更を認めない
8. Qualification と Verification を区別する
9. Execution Result は構造化するが、目的なく巨大なログへ拡張しない
10. 3 カラム Review Viewer を、入力・実行計画・ブラウザ状態を照合する中心 UI の候補とする
11. Source Map は多対多を許容し、正しい対応だけでなく未マッピングや未実行も表示する
12. Binding キャッシュと Execution Result の履歴は責務を分ける

## 12. 未決事項

次は議論で方向性が出たものの、まだ仕様として確定していない。

- Canonical Playbook IR の保存形式と Schema Versioning
- Playbook DSL を入力と可逆表示の両方にするか、Review View と分離するか
- Qualification の承認記録をプロダクト内で持つか、Git / PR レビューに委ねるか
- Source Representation と Canonical IR のどちらをリポジトリ上の編集起点にするか
- Binding の再利用をデフォルトにするか
- Binding 変更時に警告、失敗、再認定のどれを要求するか
- Execution Policy に含める設定項目
- Screenshot 以外の Observation をどこまで MVP に含めるか
- Playwright コードからの Import が保証する範囲
- Report の保存・共有方法
- 強い隔離、署名、改ざん検知が必要になる利用境界

## 13. 今後の設計・実装への示唆

次の実装へ進む前に、現行型との差分を明示したうえで以下を設計する。

1. Canonical Playbook IR における実行意味と非意味的 Metadata の境界
2. SourceDocument / SourceReference / PlanNode の多対多 Mapping
3. Tool 定義上の Step と実行 occurrence の識別
4. Step 前後を扱える Observation モデル
5. 最小の Execution Result と Reporter 入力
6. Qualification / Verification のライフサイクルと再認定条件
7. Binding 変更と Mapping Coverage を表示する Review Viewer のプロトタイプ

新しい概念を一度に現行 `@e2e-base/core` へ追加してはならない。具体的なユースケースを一本ずつ通し、Viewer または Runtime に必要なことが確認できた概念から導入する。
