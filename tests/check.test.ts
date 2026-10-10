// 検査の純関数のテスト(AC-2・AC-9〜AC-12・AC-18)。FR-3・FR-5〜FR-18 ごとに「出るべき検体」と「出てはいけない検体」を置く。
// 規則は tests/rules.fixture.json(§9.2 の JSON)。検体は合成だけ。
import { describe, expect, it } from "vitest";
import { CHECKS, runChecks } from "../src/check";
import { isTarget } from "../src/check/profile";
import { check, CLEAN, FOLDERS, kinds, lineOf, of, PATH, rules } from "./helpers";

const replace = (from: string, to: string) => {
	if (!CLEAN.includes(from)) throw new Error(`検体に無い: ${from}`);
	return CLEAN.replace(from, to);
};

describe("出てはいけない(基準の検体)", () => {
	it("契約どおりの検体は指摘0・契約型・欄1", () => {
		const r = check(CLEAN);
		expect(r.findings).toEqual([]);
		expect(r.profile).toBe("contract");
		expect(r.placeholders).toBe(1);
		expect(r.undecided).toEqual([]);
		expect(r.failed).toEqual([]);
	});
});

describe("FR-1 対象か", () => {
	const R = rules((j) => { j.targets.excludePaths = ["仕様書MDファイル/除く"]; });
	const RULES_NOTE = "仕様書MDファイル/規則.md";
	it("仕様書フォルダの下の md だけ", () => {
		expect(isTarget(PATH, "md", R, RULES_NOTE)).toBe(true);
		expect(isTarget("説明書/a.md", "md", R, RULES_NOTE)).toBe(false);
		expect(isTarget("仕様書MDファイル/a.pdf", "pdf", R, RULES_NOTE)).toBe(false);
		expect(isTarget("仕様書MDファイル/除く/a.md", "md", R, RULES_NOTE)).toBe(false);
		expect(isTarget("仕様書MDファイル/除く2/a.md", "md", R, RULES_NOTE)).toBe(true);
		expect(isTarget(RULES_NOTE, "md", R, RULES_NOTE)).toBe(false);   // 規則ノート自身(§10)
	});
});

describe("FR-3 閉じていないコードブロック(AC-9)", () => {
	it("出る: 開いた行で1件、後の節は undecided、missing_section は0、番号の検査は行う", () => {
		const text = replace("| a | {{A}} |", "| a | {{A}} |\n\n```\n閉じない");
		const r = check(text);
		expect(of(r, "unclosed_fence").map((f) => f.line)).toEqual([lineOf(text, "閉じない") - 1]);
		expect(of(r, "missing_section")).toEqual([]);
		expect(r.undecided).toEqual(expect.arrayContaining(["§9 の節", "§13 の節", "§12 の「§8」の言及", "§13 の「仮称」の行", "§8 の欄"]));
		expect(r.undecided).not.toContain("§0 の項目");                 // 前の節は判定する
		expect(kinds(r)).not.toContain("no_tentative");
		expect(of(r, "unclosed_fence")[0]?.level).toBe("violation");
		expect(check(text.replace("| FR-2 | b(D-1) | 推奨 |", "| FR-2 | b(D-9) | 推奨 |")).findings.map((f) => f.kind)).toContain("undefined_ref");
	});
	it("出てはいけない: 閉じたコードブロック(~~~ も)", () => {
		expect(kinds(check(replace("本文。\n\n## 10.", "~~~\nコード\n~~~\n\n## 10.")))).toEqual([]);
	});
});

describe("FR-4 型", () => {
	it("§0 の見出しが無ければ汎用型で、契約の検査はしない", () => {
		const r = check(replace("## 0. Claude Codeへの指示", "## 0. はじめに"));
		expect(r.profile).toBe("generic");
		expect(r.findings).toEqual([]);
	});
	it("全角の括弧・続く空白は置き換えてから比べる", () => {
		expect(check(replace("## 0. Claude Codeへの指示", "## 0.  Claude Codeへの指示")).profile).toBe("contract");
	});
	it("contract.excludePaths の下は汎用型", () => {
		const R = rules((j) => { j.contract.excludePaths = ["仕様書MDファイル/Windows/Foo"]; });
		expect(check(CLEAN, { rules: R }).profile).toBe("generic");
	});
	it("0バイト・見出し無しは汎用型で指摘0(§10)", () => {
		expect(check("")).toMatchObject({ profile: "generic", findings: [] });
		expect(check("本文だけ\nFR-1 の話")).toMatchObject({ profile: "generic" });
	});
});

describe("FR-5 H1・節・順番・余分な H2", () => {
	it("H1 の形", () => {
		expect(kinds(check(replace("# Foo — 実装仕様書 v1", "# Foo 仕様書")))).toEqual(["missing_title"]);
		expect(of(check(replace("# Foo — 実装仕様書 v1\n", "")), "missing_title")).toEqual([expect.objectContaining({ text: "H1 が無い" })]);
		expect(of(check(replace("# Foo — 実装仕様書 v1", "# Foo — 実装仕様書 v2")), "missing_title")).toEqual([]);
	});
	it("節が無い(行なし)", () => {
		const r = check(replace("## 7. 逸脱不可要件", "### 7. 逸脱不可要件"));
		expect(kinds(r)).toEqual(["missing_section"]);
		expect(r.findings[0]?.line).toBeUndefined();
	});
	it("順番・重複・余分", () => {
		const swapped = replace("## 9. インタフェース定義\n\n本文。\n\n## 10. エッジケースとエラー", "## 10. エッジケースとエラー\n\n本文。\n\n## 9. インタフェース定義");
		expect(kinds(check(swapped))).toEqual(["section_order"]);
		const dup = replace("## 10. エッジケースとエラー", "## 9. インタフェース定義\n\n## 10. エッジケースとエラー");
		expect(kinds(check(dup))).toEqual(["duplicate_section", "duplicate_section"]);
		const extra = CLEAN + "\n## 14. 改訂履歴\n\n## 付録\n";
		expect(of(check(extra), "extra_h2").map((f) => f.text)).toEqual(["14. 改訂履歴", "付録"]);
		expect(of(check(extra), "extra_h2")[0]?.level).toBe("caution");
	});
});

describe("FR-6 見出しの文言", () => {
	it("出る: 文言が違う", () => {
		const r = check(replace("## 13. 未確定事項(実装前に確認が必要)", "## 13. 未確定事項"));
		expect(of(r, "heading_text").map((f) => [f.text, f.level])).toEqual([["「13. 未確定事項」(規則は「13. 未確定事項(実装前に確認が必要)」)", "caution"]]);
	});
	it("出てはいけない: 全角の括弧だけの違い・番号だけの要素", () => {
		expect(kinds(check(replace("## 4. 前提(誤っていれば私に指摘すること)", "## 4. 前提（誤っていれば私に指摘すること）")))).toEqual([]);
		expect(kinds(check(replace("## 8. 実物を貼る節", "## 8. 何でもよい名前 ← ここに貼る")))).toEqual([]);
	});
});

describe("FR-7 小見出し", () => {
	it("出る: §3 に非スコープの H3 が無い", () => {
		const r = check(replace("### 非スコープ(実装してはならない)", "### 対象外"));
		expect(of(r, "missing_subheading").map((f) => f.text)).toEqual(["§3 に「非スコープ」で始まる小見出しが無い"]);
		expect(of(r, "missing_subheading")[0]?.line).toBe(lineOf(CLEAN, "## 3."));
	});
	it("出る: §5 の撤退基準が別の節にある(撤退の小節の検査は出さない)", () => {
		const r = check(replace("### 撤退基準", "#### 撤退基準"));
		expect(kinds(r)).toEqual(["missing_subheading"]);
	});
});

describe("FR-8 撤退の小節", () => {
	it("出る: R の定義が無い(撤退-1 の形)", () => {
		const r = check(replace("| R-1 | x | Phase 1 |", "| 撤退-1 | x | Phase 1 |"));
		expect(of(r, "retreat_empty").map((f) => f.line)).toEqual([lineOf(CLEAN, "### 撤退基準")]);
	});
	it("出てはいけない: 箇条のチェックボックスでも定義の形なら数える", () => {
		expect(kinds(check(replace("| R-1 | x | Phase 1 |", "- [ ] R-1 x")))).toEqual([]);
	});
});

describe("FR-9 §0 の項目", () => {
	it("出る/出ない", () => {
		const r = check(replace("- 推測でコードを書かない\n", ""));
		expect(of(r, "zero_phrase").map((f) => f.text)).toEqual(["§0 に「推測でコードを書かない」が無い"]);
		const R = rules((j) => { j.contract.zeroPhrases[2]?.any.push("推測で書かない"); });
		expect(kinds(check(replace("推測でコードを書かない", "推測で書かない"), { rules: R }))).toEqual([]);
	});
});

describe("FR-10 §8 の指示", () => {
	it("出る: §12 に §8 が無い / 出ない: コードブロックの中でもよい", () => {
		expect(of(check(replace("| 1 | §8 を見てから |", "| 1 | 見てから |")), "no_s8_mention").map((f) => f.text)).toEqual(["§12 に「§8」が無い"]);
		expect(kinds(check(replace("| 1 | §8 を見てから |", "```\n§8\n```")))).toEqual([]);
	});
});

describe("FR-11 名前の行", () => {
	it("出る(行なし)/ 出ない", () => {
		const r = check(replace("| Q-1 | Foo は仮称 | 私 |", "| Q-1 | Foo の名前 | 私 |"));
		expect(of(r, "no_tentative")).toEqual([{ kind: "no_tentative", level: "violation", text: "§13 に「仮称」を含む行が無い" }]);
		expect(kinds(check(replace("| Q-1 | Foo は仮称 | 私 |", "| Q-1 | x | 私 |\n- 名前は仮称")))).toEqual([]);
	});
});

describe("FR-12 §8 の欄", () => {
	it("出る: 0 個は注意 / 数を上部に出す", () => {
		const r = check(replace("| a | {{A}} |", "| a | (未記入) |"));
		expect(of(r, "no_placeholder").map((f) => f.level)).toEqual(["caution"]);
		expect(r.placeholders).toBe(0);
		expect(check(replace("| a | {{A}} |", "| a | {{A}} {{B_C}} |\n```\n{{D}}\n```")).placeholders).toBe(3);
	});
	it("§8 の外の欄は数えない", () => {
		expect(check(replace("本文。\n\n## 10.", "{{X}}\n\n## 10.")).placeholders).toBe(1);
	});
});

describe("FR-13 優先度", () => {
	it("出る: 最後のセルに語が無い / 出ない: 語を含めばよい", () => {
		const r = check(replace("| FR-3 | c | 任意 |", "| FR-3 | c | 後で |"));
		expect(of(r, "missing_priority").map((f) => [f.text, f.line])).toEqual([["FR-3", lineOf(CLEAN, "| FR-3 |")]]);
		expect(kinds(check(replace("| FR-3 | c | 任意 |", "| FR-3 | c | 必須(a)(b) / 推奨(c) |")))).toEqual([]);
	});
});

describe("FR-14 番号の抜け", () => {
	const acs = (nos: number[]) => nos.map((n) => `- [ ] AC-${n}: x`).join("\n");
	it("出る: 続く抜けは1つにまとめ、行は直前の番号の定義の行", () => {
		const text = replace("- [ ] AC-1: FR-1 を満たす\n- [ ] AC-2: x\n- [ ] AC-3: x", acs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 22]));
		const gaps = of(check(text), "numbering_gap");
		expect(gaps.map((f) => [f.text, f.line])).toEqual([
			["AC-14〜AC-19(AC-13 の行)", lineOf(text, "AC-13:")],
			["AC-21(AC-20 の行)", lineOf(text, "AC-20:")],
		]);
		expect(gaps[0]?.level).toBe("violation");
	});
	it("出る: 1 から抜けているときは直後の番号の行", () => {
		const text = replace("- [ ] AC-1: FR-1 を満たす", "- [ ] AC-4: FR-1 を満たす");
		expect(of(check(text), "numbering_gap").map((f) => f.text)).toEqual(["AC-1(AC-2 の行)"]);
	});
	it("出てはいけない: 定義が下限未満・枝番だけの違い", () => {
		expect(of(check(replace("| D-2 | a | b | c |\n", "")), "numbering_gap").map((f) => f.text)).toEqual([]);   // D-1・D-3 の2つ
		expect(kinds(check(replace("- [ ] AC-3: x", "- [ ] AC-3: x\n- [ ] AC-3b: y")))).toEqual([]);
	});
	it("下限は規則ノートから読む", () => {
		const R = rules((j) => { j.ids.gapMinDefinitions = 2; });
		expect(of(check(replace("| D-2 | a | b | c |\n", ""), { rules: R }), "numbering_gap").map((f) => f.text)).toEqual(["D-2(D-1 の行)"]);
	});
});

describe("FR-15 重複定義", () => {
	it("出る: 全部の行 / 出ない: 枝番は別の定義、FR-01 と FR-1 は同じ", () => {
		const text = replace("| FR-3 | c | 任意 |", "| FR-3 | c | 任意 |\n| FR-3 | d | 任意 |");
		expect(of(check(text), "duplicate_def").map((f) => [f.text, f.line])).toEqual([
			["FR-3(2 回定義)", lineOf(text, "| FR-3 | c")], ["FR-3(2 回定義)", lineOf(text, "| FR-3 | d")]]);
		expect(of(check(replace("| FR-3 | c | 任意 |", "| FR-03 | c | 任意 |\n| FR-3 | d | 任意 |")), "duplicate_def").length).toBe(2);
		expect(kinds(check(replace("- [ ] AC-3: x", "- [ ] AC-3: x\n- [ ] AC-3b: y")))).toEqual([]);
	});
});

describe("FR-16 定義の無い参照(AC-10)", () => {
	it("AC-10: 名前のある行は除いた参照、無い行は見つからない参照。自分の名前は除かない", () => {
		const r = check("BarTool D-9 と同じ\n月ごとの集計の画面(FR-26 既存)\nSpecLint の R-5\n", {
			path: "仕様書MDファイル/SpecLint/SpecLint_x_仕様書.md",
			folders: ["仕様書MDファイル", "仕様書MDファイル/BarTool", "仕様書MDファイル/SpecLint"],
		});
		expect(r.findings.map((f) => [f.kind, f.text, f.line, f.productName])).toEqual([
			["undefined_ref", "FR-26", 1, undefined],
			["undefined_ref", "R-5", 2, undefined],
			["excluded_ref", "D-9", 0, "BarTool"],
		]);
		expect(r.findings.map((f) => f.level)).toEqual(["caution", "caution", "info"]);
	});
	it("OS の分類名と親フォルダ名は名前にしない", () => {
		const r = check("Windows で D-9 を見る\nFoo の D-8\n", { folders: FOLDERS });
		expect(kinds(r)).toEqual(["undefined_ref", "undefined_ref"]);
	});
	it("出てはいけない: 定義がある(枝番つきでも無しでも、先頭の0も)・範囲の後ろは拾わない", () => {
		expect(kinds(check(replace("| 1 | §8 を見てから |", "| 1 | §8 を見てから。FR-01 と AC-3b と FR-1〜9 |")))).toEqual([]);
		expect(of(check(replace("| 1 | §8 を見てから |", "| 1 | §8。FR-2〜FR-9 |")), "undefined_ref").map((f) => f.text)).toEqual(["FR-9"]);
	});
	it("文字の一部(BR-1・NFR-1 の中の FR-1)は FR の参照にしない", () => {
		expect(of(check(replace("| 1 | §8 を見てから |", "| 1 | §8 BR-7 xFR-9 |")), "undefined_ref")).toEqual([]);
	});
});

describe("FR-17 未知の接頭辞", () => {
	it("出る: 接頭辞ごとに1件、最初の行と件数。検査の対象にしない", () => {
		const text = replace("| INV-1 | x |", "| INV-1 | x |\n| SEC-1 | y |\n| SEC-3 | y |\n| T-1 | z |");
		const r = check(text);
		expect(of(r, "unknown_prefix").map((f) => [f.text, f.line, f.count, f.level])).toEqual([
			["SEC(2 件。最初は SEC-1)", lineOf(text, "SEC-1"), 2, "caution"], ["T(1 件。最初は T-1)", lineOf(text, "T-1"), 1, "caution"]]);
		expect(kinds(r)).not.toContain("numbering_gap");
	});
	it("出てはいけない: checks.unknownPrefix が false", () => {
		const R = rules((j) => { j.checks.unknownPrefix = false; });
		expect(kinds(check(replace("| INV-1 | x |", "| INV-1 | x |\n| SEC-1 | y |"), { rules: R }))).toEqual([]);
	});
});

describe("FR-18 絵文字(AC-11)", () => {
	const doc = (s: string) => replace("本文。\n\n## 2.", `本文 ${s}\n\n## 2.`);
	it("AC-11: U+1F552 と U+2705 は出て、矢印や記号は出ない", () => {
		const r = check(doc("\u{1F552} 記録 ✅ 済"));
		expect(of(r, "emoji").map((f) => f.text)).toEqual(["U+1F552(\u{1F552})", "U+2705(✅)"]);
		expect(kinds(check(doc("▶ ↔ © ★ → ←")))).toEqual([]);
	});
	it("Extended_Pictographic の後に U+FE0F は出る", () => {
		expect(of(check(doc("↔️")), "emoji").map((f) => f.text)).toEqual(["U+2194(↔️)"]);
	});
	it("allow に入れると出ない(文字でも U+ の形でも)", () => {
		const R = rules((j) => { j.contract.emoji.allow = ["\u{1F552}", "U+2705"]; });
		expect(kinds(check(doc("\u{1F552} ✅"), { rules: R }))).toEqual([]);
	});
	it("汎用型には当てない", () => {
		expect(kinds(check("# x\n\u{1F552}\n"))).toEqual([]);
	});
});

describe("AC-12 定義の形", () => {
	it("コロン無しのチェックボックス・取り消し線・枝番は定義、箇条書きは定義でない", () => {
		const text = "- [ ] AC-9(較正):\n| ~~Q-3~~ | x |\n- [ ] AC-4b: y\n- Q-1 本文\n参照 AC-9 Q-3 AC-4 Q-1\n";
		const r = check(text);
		expect(r.findings.map((f) => [f.kind, f.text, f.line])).toEqual([["undefined_ref", "Q-1", 3], ["undefined_ref", "Q-1", 4]]);
	});
});

describe("§10 の端", () => {
	it("同じ番号の H2 が2つなら本文は両方を合わせて使う", () => {
		const text = replace("## 13. 未確定事項(実装前に確認が必要)\n\n| # | 内容 | 回答者 |\n|---|---|---|\n| Q-1 | Foo は仮称 | 私 |",
			"## 13. 未確定事項(実装前に確認が必要)\n\nなし\n\n## 13. 未確定事項(実装前に確認が必要)\n\n- 仮称の行");
		expect(kinds(check(text))).toEqual(["duplicate_section", "duplicate_section"]);
	});
	it("checks.ids が false なら番号の検査をしない", () => {
		const R = rules((j) => { j.checks.ids = false; });
		expect(kinds(check("BarTool D-9\nFR-26\n", { rules: R }))).toEqual([]);
	});
});

describe("並び順(CLI 版 FR-9 の順)", () => {
	it("違反の種類の順・同じ種類は行の順", () => {
		const text = "```\n" + replace("# Foo — 実装仕様書 v1", "# Foo") + "\nFR-99\n";
		const r = check("FR-98\n" + text);
		expect(kinds(r).slice(0, 3)).toEqual(["unclosed_fence", "undefined_ref", "undefined_ref"]);
	});
});

describe("FR-23 落ちた検査(AC-18)", () => {
	it("例外を投げる検査が1つあっても、残りの結果と failed 1件が返る", () => {
		const boom = { name: "爆発", on: () => true, run: (): never => { throw new Error("わざと"); } };
		const text = replace("| FR-3 | c | 任意 |", "| FR-3 | c | 後で |");
		const r = runChecks({ path: PATH, text, folders: FOLDERS }, rules(), [CHECKS[0]!, boom, ...CHECKS.slice(1)]);
		expect(r.failed).toEqual([{ check: "爆発", message: "わざと" }]);
		expect(kinds(r)).toEqual(["missing_priority"]);
	});
});
