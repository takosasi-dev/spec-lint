// 規則ノートの読み込みと検証(FR-2・§10・AC-8 の純関数の部分)と、設定の補い(§9.3)のテスト。
import { describe, expect, it } from "vitest";
import { isRulesError, parseRules, type RulesJson } from "../src/rules/validate";
import { cleanRulesPath, DEFAULTS, normalizeSettings } from "../src/settings";
import { FIXTURE, note } from "./helpers";

const withJson = (patch: (j: RulesJson & Record<string, unknown>) => void) => {
	const j = JSON.parse(FIXTURE) as RulesJson & Record<string, unknown>;
	patch(j);
	return parseRules(note(JSON.stringify(j)));
};

describe("FR-2 規則ノート", () => {
	it("§9.2 の JSON は通り、updated と正規表現が入る", () => {
		const r = parseRules(note(FIXTURE));
		if (isRulesError(r)) throw new Error(r.reason);
		expect(r.updated).toBe("2026-09-26");
		expect(r.re.define.length).toBe(2);
		expect(r.placeholderSection).toBe("8");
		expect(r.contract.subheadings["5"]).toEqual(["撤退基準"]);
	});
	it("json のブロックが0個・2個・閉じていない", () => {
		expect(parseRules("# 規則\n本文だけ")).toEqual({ reason: "json のブロックが無い" });
		expect(parseRules(note(FIXTURE) + "\n```json\n{}\n```\n")).toEqual({ reason: "json のブロックが 2 個ある(1個だけにする)" });
		expect(parseRules("```json\n{")).toEqual({ reason: "json のブロックが閉じていない" });
		expect(isRulesError(parseRules("```ts\nx\n```\n" + note(FIXTURE)))).toBe(false);   // json 以外のブロックは数えない
	});
	it("JSON が壊れている(JSON.parse のメッセージを出す)", () => {
		const r = parseRules(note("{ \"schemaVersion\": 1,"));
		expect(isRulesError(r) && r.reason.startsWith("JSON が壊れている(")).toBe(true);
	});
	it("形が違う: 項目名を出す(AC-8 の contract.headings)", () => {
		expect(withJson((j) => { delete (j.contract as Partial<RulesJson["contract"]>).headings; })).toEqual({ reason: "形が違う", item: "contract.headings" });
		expect(withJson((j) => { j.schemaVersion = 2 as 1; })).toEqual({ reason: "形が違う", item: "schemaVersion" });
		expect(withJson((j) => { j.ids.gapMinDefinitions = "3" as unknown as number; })).toEqual({ reason: "形が違う", item: "ids.gapMinDefinitions" });
		expect(withJson((j) => { j.contract.headings = ["一. 何か"]; })).toEqual({ reason: "形が違う", item: "contract.headings[0]" });
		expect(withJson((j) => { j.contract.zeroPhrases = [{ name: "x" } as RulesJson["contract"]["zeroPhrases"][number]]; }))
			.toEqual({ reason: "形が違う", item: "contract.zeroPhrases[0].any" });
	});
	it("definePatterns の捕まえる組が3つでない", () => {
		expect(withJson((j) => { j.ids.definePatterns = ["^\\|\\s*([A-Z]+)-(\\d+)\\s*\\|"]; })).toEqual({ reason: "形が違う", item: "ids.definePatterns[0]" });
	});
	it("正規表現が作れない: 項目名と「この端末では使えない規則」", () => {
		const r = withJson((j) => { j.contract.title = "^# (.+$"; });
		expect(isRulesError(r) && r.item === "contract.title" && r.reason.startsWith("この端末では使えない規則(")).toBe(true);
		const e = withJson((j) => { j.contract.emoji.pattern = "\\p{NoSuchProperty}"; });
		expect(isRulesError(e) && e.item).toBe("contract.emoji.pattern");
	});
	it("フォルダの末尾の / は外す", () => {
		const r = withJson((j) => { j.targets.specFolders = ["仕様書MDファイル/"]; });
		expect(!isRulesError(r) && r.targets.specFolders).toEqual(["仕様書MDファイル"]);
	});
});

describe("§9.3 設定", () => {
	const norm = (p: string) => p.replace(/\\/g, "/");
	it("無ければ既定値、欠けは既定値で埋める", () => {
		expect(normalizeSettings(null, norm)).toEqual({ settings: DEFAULTS, problem: false });
		expect(normalizeSettings({ autoCheck: false }, norm)).toEqual({ settings: { ...DEFAULTS, autoCheck: false }, problem: false });
		expect(normalizeSettings({ rulesNotePath: "a\\b.md" }, norm).settings.rulesNotePath).toBe("a/b.md");
	});
	it("規則ノートのパスは既定では空(未設定)。保存してある値はそのまま生き、空・空白だけ・/ は未設定になる", () => {
		const obsidianNorm = (p: string) => norm(p).replace(/^\/+|\/+$/g, "") || "/";   // normalizePath("") は "/" を返す
		expect(DEFAULTS.rulesNotePath).toBe("");
		expect(normalizeSettings({ rulesNotePath: "Docs/SpecLint rules.md" }, obsidianNorm).settings.rulesNotePath).toBe("Docs/SpecLint rules.md");
		for (const unset of ["", "  ", "/"]) {
			expect(cleanRulesPath(unset, obsidianNorm)).toBe("");
			expect(normalizeSettings({ rulesNotePath: unset }, obsidianNorm).settings.rulesNotePath).toBe("");
		}
		expect(cleanRulesPath(" Docs\\rules.md ", obsidianNorm)).toBe("Docs/rules.md");
	});
	it("壊れている・schemaVersion が違うときは既定値と problem", () => {
		expect(normalizeSettings("x", norm)).toEqual({ settings: DEFAULTS, problem: true });
		expect(normalizeSettings({ schemaVersion: 2, autoCheck: false }, norm)).toEqual({ settings: DEFAULTS, problem: true });
	});
});
