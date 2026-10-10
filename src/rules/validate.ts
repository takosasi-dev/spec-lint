// 規則ノートの json を §9.2 の形か確かめ、正規表現を作って Rules にする(FR-2)。純関数。obsidian を import しない。
// 規則の値はここに書かない(INV-5)。形が違えば項目名を、正規表現が作れなければ項目名と理由を返し、検査させない(INV-6)。
// definePatterns の各式は捕まえる組がちょうど3つ(接頭辞・番号・枝番)であることを確かめる。
import { extractJson, type RulesError } from "./extract";

export interface RulesJson {
	schemaVersion: 1;
	updated: string;
	targets: { specFolders: string[]; excludePaths: string[] };
	checks: { contract: boolean; emoji: boolean; ids: boolean; unknownPrefix: boolean };
	ids: { prefixes: string[]; definePatterns: string[]; gapMinDefinitions: number; productNameIgnore: string[] };
	contract: {
		detectHeading: string;
		excludePaths: string[];
		title: string;
		headings: string[];
		subheadings: Record<string, string[]>;
		retreat: { section: number; subheading: string; prefix: string };
		zeroPhrases: { name: string; any: string[] }[];
		section8MentionIn: number[];
		section8Mention: string;
		tentativeName: { section: number; word: string };
		placeholder: string;
		priority: { prefix: string; words: string[] };
		emoji: { pattern: string; allow: string[] };
	};
}

export interface Rules extends RulesJson {
	re: {
		title: RegExp;
		define: RegExp[];
		/** g つき */
		placeholder: RegExp;
		/** gu つき(§9.6) */
		emoji: RegExp;
		/** 参照の形(§9.6)。prefixes が空なら null */
		ref: RegExp | null;
	};
	/** 欄を数える節(section8Mention の数字) */
	placeholderSection: string;
}

export type { RulesError };
export const isRulesError = (r: Rules | RulesError): r is RulesError => "reason" in r;

class Shape extends Error {
	constructor(readonly item: string) {
		super(item);
	}
}
class Unusable extends Error {
	constructor(readonly item: string, message: string) {
		super(message);
	}
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
function rec(v: unknown, item: string): Rec {
	if (isRec(v)) return v;
	throw new Shape(item);
}
function str(v: unknown, item: string): string {
	if (typeof v === "string") return v;
	throw new Shape(item);
}
function bool(v: unknown, item: string): boolean {
	if (typeof v === "boolean") return v;
	throw new Shape(item);
}
function num(v: unknown, item: string): number {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	throw new Shape(item);
}
function strs(v: unknown, item: string): string[] {
	if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v;
	throw new Shape(item);
}
function nums(v: unknown, item: string): number[] {
	if (Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x))) return v as number[];
	throw new Shape(item);
}
const folders = (xs: string[]) => xs.map((x) => x.trim().replace(/\/+$/, "")).filter((x) => x !== "");

function regex(src: string, flags: string, item: string): RegExp {
	try {
		return new RegExp(src, flags);
	} catch (e) {
		throw new Unusable(item, e instanceof Error ? e.message : String(e));
	}
}

/** 捕まえる組の数(空文字に必ず当たる形にして数える) */
const groupCount = (re: RegExp): number => (new RegExp(re.source + "|", re.flags).exec("")?.length ?? 1) - 1;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function shape(raw: unknown): RulesJson {
	const root = rec(raw, "(全体)");
	if (root.schemaVersion !== 1) throw new Shape("schemaVersion");
	const t = rec(root.targets, "targets");
	const ch = rec(root.checks, "checks");
	const ids = rec(root.ids, "ids");
	const c = rec(root.contract, "contract");
	const headings = strs(c.headings, "contract.headings");
	if (headings.length === 0) throw new Shape("contract.headings");
	headings.forEach((h, i) => {
		if (!/^\d+/.test(h)) throw new Shape(`contract.headings[${i}]`);
	});
	const sub = rec(c.subheadings, "contract.subheadings");
	const subheadings: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(sub)) {
		if (!/^\d+$/.test(k)) throw new Shape(`contract.subheadings.${k}`);
		subheadings[String(Number(k))] = strs(v, `contract.subheadings.${k}`);
	}
	const retreat = rec(c.retreat, "contract.retreat");
	const tentative = rec(c.tentativeName, "contract.tentativeName");
	const priority = rec(c.priority, "contract.priority");
	const emoji = rec(c.emoji, "contract.emoji");
	if (!Array.isArray(c.zeroPhrases)) throw new Shape("contract.zeroPhrases");
	const zeroPhrases = c.zeroPhrases.map((z: unknown, i) => {
		const item = `contract.zeroPhrases[${i}]`;
		const o = rec(z, item);
		return { name: str(o.name, item + ".name"), any: strs(o.any, item + ".any") };
	});
	return {
		schemaVersion: 1,
		updated: str(root.updated, "updated"),
		targets: { specFolders: folders(strs(t.specFolders, "targets.specFolders")), excludePaths: folders(strs(t.excludePaths, "targets.excludePaths")) },
		checks: {
			contract: bool(ch.contract, "checks.contract"),
			emoji: bool(ch.emoji, "checks.emoji"),
			ids: bool(ch.ids, "checks.ids"),
			unknownPrefix: bool(ch.unknownPrefix, "checks.unknownPrefix"),
		},
		ids: {
			prefixes: strs(ids.prefixes, "ids.prefixes"),
			definePatterns: strs(ids.definePatterns, "ids.definePatterns"),
			gapMinDefinitions: num(ids.gapMinDefinitions, "ids.gapMinDefinitions"),
			productNameIgnore: strs(ids.productNameIgnore, "ids.productNameIgnore"),
		},
		contract: {
			detectHeading: str(c.detectHeading, "contract.detectHeading"),
			excludePaths: folders(strs(c.excludePaths, "contract.excludePaths")),
			title: str(c.title, "contract.title"),
			headings,
			subheadings,
			retreat: {
				section: num(retreat.section, "contract.retreat.section"),
				subheading: str(retreat.subheading, "contract.retreat.subheading"),
				prefix: str(retreat.prefix, "contract.retreat.prefix"),
			},
			zeroPhrases,
			section8MentionIn: nums(c.section8MentionIn, "contract.section8MentionIn"),
			section8Mention: str(c.section8Mention, "contract.section8Mention"),
			tentativeName: { section: num(tentative.section, "contract.tentativeName.section"), word: str(tentative.word, "contract.tentativeName.word") },
			placeholder: str(c.placeholder, "contract.placeholder"),
			priority: { prefix: str(priority.prefix, "contract.priority.prefix"), words: strs(priority.words, "contract.priority.words") },
			emoji: { pattern: str(emoji.pattern, "contract.emoji.pattern"), allow: strs(emoji.allow, "contract.emoji.allow") },
		},
	};
}

function compile(j: RulesJson): Rules {
	const define = j.ids.definePatterns.map((p, i) => {
		const item = `ids.definePatterns[${i}]`;
		const re = regex(p, "u", item);
		if (groupCount(re) !== 3) throw new Shape(item);
		return re;
	});
	const sec = /\d+/.exec(j.contract.section8Mention)?.[0];
	if (sec === undefined) throw new Shape("contract.section8Mention");
	const prefixes = j.ids.prefixes.filter((p) => p !== "");
	return {
		...j,
		re: {
			title: regex(j.contract.title, "u", "contract.title"),
			define,
			placeholder: regex(j.contract.placeholder, "gu", "contract.placeholder"),
			emoji: regex(j.contract.emoji.pattern, "gu", "contract.emoji.pattern"),
			ref: prefixes.length ? regex(`(^|[^A-Za-z])(${prefixes.map(escapeRe).join("|")})-(\\d+)([a-z]?)`, "gu", "ids.prefixes") : null,
		},
		placeholderSection: String(Number(sec)),
	};
}

/** 規則ノートの本文から Rules を作る。だめなら RulesError(FR-2・§10) */
export function parseRules(note: string): Rules | RulesError {
	const block = extractJson(note);
	if ("reason" in block) return block;
	let raw: unknown;
	try {
		raw = JSON.parse(block.json);
	} catch (e) {
		return { reason: `JSON が壊れている(${e instanceof Error ? e.message : String(e)})` };
	}
	try {
		return compile(shape(raw));
	} catch (e) {
		if (e instanceof Shape) return { reason: "形が違う", item: e.item };
		if (e instanceof Unusable) return { reason: `この端末では使えない規則(${e.message})`, item: e.item };
		throw e;
	}
}
