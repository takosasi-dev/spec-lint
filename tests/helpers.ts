// テストの共通部品: §9.2 の JSON(rules.fixture.json)から Rules を作る・合成の検体を検査する。
// 検体は合成だけ(実 vault の本文を写さない)。
/* global process -- vitest は Node で走るので process を使う */
import { runChecks, type CheckResult } from "../src/check";
import { isRulesError, parseRules, type Rules, type RulesJson } from "../src/rules/validate";

const fs = process.getBuiltinModule("node:fs");
export const FIXTURE = fs.readFileSync(new URL("./rules.fixture.json", import.meta.url), "utf8");

export const note = (json: string) => "# 規則\n\n出典の説明。\n\n```json\n" + json + "\n```\n";

export function rules(patch?: (j: RulesJson) => void): Rules {
	const j = JSON.parse(FIXTURE) as RulesJson;
	patch?.(j);
	const r = parseRules(note(JSON.stringify(j, null, 1)));
	if (isRulesError(r)) throw new Error(`${r.reason} ${r.item ?? ""}`);
	return r;
}

export const PATH = "仕様書MDファイル/Windows/Foo/Foo_検体_仕様書.md";
export const FOLDERS = ["仕様書MDファイル", "仕様書MDファイル/Windows", "仕様書MDファイル/Windows/Foo", "仕様書MDファイル/Windows/BarTool"];

export function check(text: string, opt: { rules?: Rules; path?: string; folders?: string[] } = {}): CheckResult {
	return runChecks({ path: opt.path ?? PATH, text, folders: opt.folders ?? FOLDERS }, opt.rules ?? rules());
}

export const kinds = (r: CheckResult) => r.findings.map((f) => f.kind);
export const of = (r: CheckResult, kind: string) => r.findings.filter((f) => f.kind === kind);

/** 契約どおりで指摘が0の検体(行番号は 0 始まりで数える) */
export const CLEAN = `# Foo — 実装仕様書 v1

## 0. Claude Codeへの指示

- フェーズごとに停止する
- 仕様に書かれていないことは実装しない
- 推測でコードを書かない
- 各ファイルの先頭に責務を3行以内で書く
- §8 が空なら止まる

## 1. 目的

本文。

## 2. アーキテクチャ

\`\`\`
[図] → 次
\`\`\`

## 3. スコープ / 非スコープ

### スコープ
- a

### 非スコープ(実装してはならない)
- b

## 4. 前提(誤っていれば私に指摘すること)

- c

## 5. 決定事項と理由

| # | 決定 | 却下案 | 理由 |
|---|---|---|---|
| D-1 | a | b | c |
| D-2 | a | b | c |
| D-3 | a | b | c |

### 撤退基準

| # | 条件 | 判定期日 |
|---|---|---|
| R-1 | x | Phase 1 |

## 6. 機能要件

| ID | 要件 | 優先度 |
|---|---|---|
| FR-1 | a | 必須 |
| FR-2 | b(D-1) | 推奨 |
| FR-3 | c | 任意 |

## 7. 逸脱不可要件

| ID | 要件 |
|---|---|
| INV-1 | x |

## 8. 実物を貼る節

| 項目 | 実物 |
|---|---|
| a | {{A}} |

## 9. インタフェース定義

本文。

## 10. エッジケースとエラー

本文。

## 11. 受け入れ基準

- [ ] AC-1: FR-1 を満たす
- [ ] AC-2: x
- [ ] AC-3: x

## 12. 実装フェーズ

| Phase | 内容 |
|---|---|
| 1 | §8 を見てから |

## 13. 未確定事項(実装前に確認が必要)

| # | 内容 | 回答者 |
|---|---|---|
| Q-1 | Foo は仮称 | 私 |
`;

/** CLEAN の1行目から数えた、その文字を含む最初の行(0 始まり) */
export const lineOf = (text: string, s: string) => text.split("\n").findIndex((l) => l.includes(s));
