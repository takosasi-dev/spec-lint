# Spec Lint

開いている仕様書のノート 1 本を、vault の中の「規則ノート」に書いた決まり(見出しの有無と順番、番号の抜けと重複、定義の見つからない番号の参照、絵文字など)で検査し、右サイドバーに違反・注意・情報の一覧で出す Obsidian プラグインです。読むだけで、仕様書も規則ノートも書き換えません。ネットワークには出ません。PC でもモバイルでも動く作りです。

*English summary is at the bottom.*

> **先に知っておくこと: 規則ノートを vault に置き、その場所を設定の「規則ノートのパス」に入れるまで、何も検査しません。**
> 検査の中身(対象のフォルダ・見出しの一覧・番号の形)は、全部そのノートの json のブロック 1 つから読みます。プラグインは規則ノートを作りませんし、書き換えません。形は下の「規則ノート」にあります。「規則ノートのパス」は、入れた直後は空(未設定)です。

## できること
- **形の検査**: H1 の形、あるべき節(H2)の有無・順番・重複・文言、節の中の小見出し、決まった言い回しや欄があるか
- **番号の検査**: `FR-1` の形の番号の、重複定義・抜け・定義が見つからない参照・知らない接頭辞
- **絵文字の検査**: 規則に当たる文字を、行と文字の番号(`U+1F552` の形)で出す
- **重さで分ける**: 違反 / 注意 / 情報 の 3 つの組で出す
- **行へ移る**: 行のある指摘を押すと、仕様書のその行へカーソルが移る
- **自動で検査し直す**: 仕様書を開いたときと、仕様書か規則ノートが変わったとき
- **判定しなかった物も出す**: コードブロックが閉じていないと、その後ろの節は合否を出さず「判定していない検査」に入れる

## 向いている vault(前提)

番号つきの見出し(`## 3. 機能` の形の H2)で節を分け、要件や決定に `FR-1`・`D-1` の形の番号を振って、表かチェックボックスの行で定義している仕様書を、決まったフォルダに置いている vault です。節の名前や番号の接頭辞は、規則ノートで自分の書き方に合わせます。下の規則ノートの例に合う仕様書は、たとえば次の形です。

```markdown
# Foo 仕様書 v1

## 0. 実装する人への指示
- 書いていないことは作らない。§4 が空なら止まる
## 1. 目的
何を作るかを書く。
## 2. 決めたこと
| # | 決定 |
|---|---|
| D-1 | 保存は 1 つのファイルにする |
### やめる条件
| # | 条件 |
|---|---|
| R-1 | 2 週間で動かなければやめる |
## 3. 機能
| ID | 要件 | 優先度 |
|---|---|---|
| FR-1 | 一覧を出す(D-1) | 必須 |
## 4. 実物を貼る所
| 項目 | 実物 |
|---|---|
| 設定ファイル | {{CONFIG}} |
## 5. 受け入れ基準
- [ ] AC-1: FR-1 を満たす
## 6. 未確定のこと
- Foo は仮の名前
```

### 規則ノート

vault のどこかに md を 1 本作り、中に json のブロックを **ちょうど 1 つ** 書きます(0 個や 2 個以上だと検査しません)。ブロックの外の文は読まれないので、説明を自由に書けます。置いた場所を、設定の「規則ノートのパス」に入れます(例: `Docs/SpecLint rules.md`。入れた直後は空で、入れるまでは規則ノートを探しません)。

````markdown
# 仕様書の検査の規則

下の json のブロック 1 つが規則のすべて。

```json
{
  "schemaVersion": 1,
  "updated": "2026-01-15",
  "targets": { "specFolders": ["Specs"], "excludePaths": ["Specs/Archive"] },
  "checks": { "contract": true, "emoji": true, "ids": true, "unknownPrefix": true },
  "ids": {
    "prefixes": ["FR", "AC", "D", "R"],
    "definePatterns": [
      "^\\|\\s*([A-Z]+)-(\\d+)([a-z]?)\\s*\\|",
      "^\\s*-\\s\\[[ xX]\\]\\s*([A-Z]+)-(\\d+)([a-z]?)"
    ],
    "gapMinDefinitions": 3, "productNameIgnore": ["Archive"]
  },
  "contract": {
    "detectHeading": "0. 実装する人への指示", "excludePaths": [],
    "title": "^# .+ 仕様書 v\\d+$",
    "headings": ["0. 実装する人への指示", "1. 目的", "2. 決めたこと", "3. 機能", "4.", "5. 受け入れ基準", "6. 未確定のこと"],
    "subheadings": { "2": ["やめる条件"] },
    "retreat": { "section": 2, "subheading": "やめる条件", "prefix": "R" },
    "zeroPhrases": [{ "name": "書いていないことは作らない", "any": ["書いていないことは作らない", "仕様に無いことは作らない"] }],
    "section8MentionIn": [0], "section8Mention": "§4", "placeholder": "\\{\\{.*?\\}\\}",
    "tentativeName": { "section": 6, "word": "仮の名前" },
    "priority": { "prefix": "FR", "words": ["必須", "任意"] },
    "emoji": { "pattern": "\\p{Emoji_Presentation}", "allow": [] }
  }
}
```
````

項目は 1 つも省けません。欠けている・型が違うと `形が違う: <項目>` と出て、検査をしません。

| 項目 | 中身 |
|---|---|
| `updated` | 規則を直した日。パネルに出るだけ |
| `targets` | `specFolders` の下の md が検査の対象(フォルダを 1 つ以上書く)。`excludePaths` は外すフォルダやファイル |
| `checks` | 大きな切り替え 4 つ。`contract`(形)・`emoji`(絵文字)・`ids`(番号)・`unknownPrefix`(知らない接頭辞) |
| `ids.prefixes` | 番号の接頭辞。ここに無い接頭辞で定義の形をした行は「未知の接頭辞」に出る |
| `ids.definePatterns` | 番号を定義している行の正規表現。捕まえる組を 3 つ(接頭辞・番号・枝番)にする。例は「表の行の先頭のセル」と「チェックボックスの行の先頭」 |
| `ids.gapMinDefinitions` | 同じ接頭辞の定義がこの数以上あるときだけ、番号の抜けを見る |
| `ids.productNameIgnore` | 対象フォルダの下のフォルダ名のうち、「ほかの文書の名前」と見なさない物(下の「除いた参照」) |
| `contract.detectHeading` | この H2 がある仕様書を「契約型」として形の検査をする。無ければ「汎用型」で、番号の検査だけ。`contract.excludePaths` の下は、あっても汎用型 |
| `contract.title` / `headings` | H1 の行の正規表現と、あるべき H2 の並び。H2 は先頭の数字が節の番号。`"4."` のように番号だけ書くと、文言は比べない |
| `contract.subheadings` / `retreat` | 節の番号ごとの、あるべき H3 の書き出し / その H3 の下に、指定の接頭辞の定義が 1 つはあること |
| `contract.zeroPhrases` | 番号 0 の節の本文に入っているべき言い回し(`any` のどれかがあればよい) |
| `contract.section8Mention` / `section8MentionIn` / `placeholder` | `section8MentionIn` の節に `section8Mention` の文字(例は `§4`)があること。その文字の中の数字の節で、`placeholder` の形の欄を数える(0 個なら注意) |
| `contract.tentativeName` / `priority` | 指定の節に指定の語を含む行があること / 1 つ目の `definePatterns` に当たる `prefix` の行は、最後のセルに `words` のどれかを含むこと |
| `contract.emoji` | 絵文字と見なす文字の正規表現と、許す文字(文字そのものか `U+1F552` の形) |

## 入れ方

### BRAT で入れる(おすすめ)
1. コミュニティプラグインの「BRAT」(Obsidian42 - BRAT)を入れて有効にする。
2. BRAT の設定 → 「Add Beta plugin」に `takosasi-dev/spec-lint` を入れる。
3. コミュニティプラグインの一覧で「Spec Lint」を有効にする。

### 手で入れる
[Releases](https://github.com/takosasi-dev/spec-lint/releases) から `main.js`・`manifest.json`・`styles.css` を落とし、vault の `.obsidian/plugins/spec-lint/` に置いて、コミュニティプラグインの一覧で有効にします。

### 入れたら最初に設定する

1. 上の「規則ノート」の形の md を、自分の vault に 1 本作る。
2. 設定 → Spec Lint の「規則ノートのパス」に、その md の vault からのパスを入れる(例: `Docs/SpecLint rules.md`)。

入れるまでは、パネルに `規則ノートのパスが未設定。設定 → Spec Lint の「規則ノートのパス」で指定する` と出るだけで、規則ノートを探さず、検査を 1 つもしません。

## 使い方

規則ノートを置いて設定にパスを入れたら、対象フォルダの仕様書を開きます。自動で検査されるので、コマンドでパネルを開いて結果を見ます。仕様書を直して保存すると、検査し直します。

### コマンド
| コマンドパレットに出る名前 | すること |
|---|---|
| Spec Lint: 仕様書の検査パネルを開く | 右サイドバーにパネル「仕様書の検査」を出す |
| Spec Lint: 開いている仕様書を検査し直す | 今開いている仕様書を検査する。自動検査を切っていても動く。「規則ノートのパス」が未設定のときは、検査せずにパネルを開いて、設定する項目を知らせる |

既定のホットキーはありません。

### 画面の見方

パネルには上から、ボタン「検査し直す」、`仕様書: <パス>(契約型)`(か `(汎用型)`)、`規則: <規則ノートのパス>(updated <日付>)`、`検査: <時刻>(所要 N ms)/ §4 の欄 N 個 / 違反 N・注意 N・情報 N`(§ の後ろは、欄を数える節の番号)、指摘の組「違反」「注意」「情報」(「情報」は畳んである)、`判定していない検査(N) / 落ちた検査(N)` が並びます。指摘 1 件は、種類・文・`行 N` です。

| 重さ | 種類(画面に出る名前) |
|---|---|
| 違反 | 閉じていないコードブロック / 重複定義 / H1 / 節が無い / 節の順番 / 節の重複 / 小見出しが無い / 小節に番号が無い / §0 の項目 / 言及が無い / 名前の行が無い / 番号の抜け / 優先度が無い / 絵文字 |
| 注意 | 定義が見つからない参照 / 見出しの文言 / 一覧に無い H2 / 欄が無い / 未知の接頭辞 |
| 情報 | 除いた参照 |

- どの型にも当てるのは、閉じていないコードブロックと番号の検査(重複定義・番号の抜け・定義が見つからない参照・除いた参照・未知の接頭辞)。ほかは契約型だけです
- 「除いた参照」は、その仕様書に定義の無い番号のうち、同じ行に対象フォルダの下のフォルダ名(ほかの文書の名前)がある物です。ほかの文書の番号を指していると見て、注意から外します
- 「節が無い」「名前の行が無い」は行を持たないので、押せません

検査をしなかったときは、理由が出ます: `規則ノートのパスが未設定。設定 → Spec Lint の「規則ノートのパス」で指定する`(下に `規則ノートが決まるまで、検査を1つもしない`。何を開いていても、これだけが出ます) / `対象外: 何も開いていない` / `対象外(仕様書フォルダの md でない): <パス>` / `対象外(規則ノート自身): <パス>` / `対象外(削除された): <パス>` / `自動検査は切ってある。「検査し直す」かコマンドで検査する` / `規則ノートが読めないので、検査を1つもしていない`。最後の物は、上に理由が出ます(`規則ノートが見つからない: <パス>`・`json のブロックが無い`・`json のブロックが N 個ある(1個だけにする)`・`json のブロックが閉じていない`・`JSON が壊れている(…)`・`形が違う: <項目>`・`この端末では使えない規則(…): <項目>`)。

## 設定
| 項目 | 既定 | 内容 |
|---|---|---|
| 規則ノートのパス | 空(未設定) | vault からのパス(例: `Docs/SpecLint rules.md`)。中の json のブロック1つが検査の規則のすべて。未設定のあいだは検査を1つもしない。空に戻すと未設定に戻る(`/` だけを入れても未設定) |
| 自動検査 | ON | 仕様書を開いたときと、仕様書か規則ノートが変わったときに検査する。切ると、ボタンかコマンドでだけ検査する |

設定画面にあるのはこの 2 つだけです。ほかは全部、規則ノートに書きます。

## 安全のための決まり
- 仕様書も規則ノートも書き換えません。直すボタンはありません。本文を読むのは、開いている仕様書 1 本と規則ノート 1 本だけです
- 書くのは自分の `data.json`(上の設定 2 つ)だけです。`data.json` が壊れているときは既定値で動き、パネルの上に `設定(data.json)が読めないので既定値で動いている。data.json は書き換えていない` と出ます(その後、設定画面で値を変えると、そのとき書き直します)
- ネットワークに出ません。Node.js / Electron の機能を使いません(モバイルでも動く作り)
- クリップボードには書きません。知らせ(Notice)も出しません。結果はパネルの中だけに出ます

## 動作確認の状況
- 版 0.1.1。Windows の Obsidian 1.14.4 で動作を確認(規則ノートが無いと検査しないこと・置くと検査すること・指摘を押すとその行に移ること)
- iPhone・Android の実機は未確認(モバイル表示のエミュレーションで読み込みと表示まで確認)。絵文字の規則(`\p{…}` を使う正規表現)が実機で作れるかも未確認です。作れないと `この端末では使えない規則` と出て、検査をしません
- 仕様書を直して保存したときに押さずに検査し直すこと、読み取りビューで開いているときの行への移動、検査にかかる時間は、まだ確かめていません
- 「規則ノートのパス」が未設定のとき(0.1.1 で既定を空にした)にパネルに案内が出ることは、Obsidian の中でも確かめました。パネルを閉じた状態で「開いている仕様書を検査し直す」を使うとパネルが開くことは、まだ見ていません

## 分かっている限界
- 検査するのは、開いている 1 本だけです。フォルダ全部をまとめて検査する機能はありません
- 結果はパネルの中だけです。パネルを開いていないと何も見えません。結果のコピーや書き出しもありません
- 「定義が見つからない参照」は、リンク切れの断定ではありません。その仕様書の中に定義の行が見つからなかった、という事実だけを出します
- 定義として数えるのは `definePatterns` に当たる行だけです。上の例の規則では、箇条書きで書いた番号(`- D-1 …` の形)は定義に数えません
- `checks` の切り替えは 4 つだけです。形の検査は、中の 1 つずつでは切れません。言い回しを探す節(番号 0)も固定です
- vault の直下の md は対象にできません(`specFolders` にフォルダを書きます)。規則ノートを開いて直している間は、パネルが `対象外(規則ノート自身)` になります

## 開発
```
npm install
npm run build        # main.js を作る(型チェックつき)
npm test             # vitest
npm run lint         # eslint-plugin-obsidianmd
```
規則の読み取りと検査は obsidian を import しない関数で、テストは作り物の仕様書と規則だけを使います。

## ライセンス
MIT。[LICENSE](LICENSE) を見てください。

---

## English summary
**Spec Lint** checks the open specification note against rules that you keep in a "rules note" in your vault, and lists the findings in a sidebar panel.
- **Nothing is checked until you create the rules note**: a Markdown note with exactly one `json` code block. Every rule (target folders, required headings, ID prefixes, patterns) is read from it. **The path is empty by default: set "規則ノートのパス" (rules note path, e.g. `Docs/SpecLint rules.md`) in settings first.** Until then the panel only tells you to set it; the plugin does not look for a rules note and checks nothing.
- Structure checks: H1 pattern, required numbered H2 sections (presence, order, duplicates, wording), required H3s, required phrases, placeholders.
- ID checks for IDs such as `FR-1`: duplicate definitions, gaps in numbering, references with no definition in the note, unknown prefixes. Emoji check with an allow list.
- Findings are grouped as violations, cautions, and info; click one to move the cursor to that line. Checks that could not be decided (for example after an unclosed code block) are listed separately.
- Read-only: never changes the spec or the rules note. Writes only its own `data.json`. No network, no clipboard, no notices, no Node.js or Electron APIs.
- Checks one open note at a time; there is no whole-folder run.
- Install with BRAT: `takosasi-dev/spec-lint`. The UI is in Japanese.
- Tested on Windows desktop (Obsidian 1.14.4) only; real phones, re-checking on save, and jumping to a line in Reading view are untested.
