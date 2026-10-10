// 検査の入口: 行と節を読み、型を決め、検査を1つずつ try/catch で回して CheckResult にする(FR-23・INV-11)。
// 指摘は CLI 版 FR-9 の順(KINDS の順)、同じ種類の中は行の順に並べる。純関数。obsidian を import しない。
// 検査の一覧 CHECKS はテストで差し替えられる(AC-18)。
import type { Rules } from "../rules/validate";
import * as contract from "./contract";
import { checkEmoji } from "./emoji";
import { finding, KINDS, type Ctx, type DefScan, type Finding } from "./finding";
import * as ids from "./ids";
import { scanLines } from "./lines";
import { profileOf, type Profile } from "./profile";

export interface CheckResult {
	path: string;
	profile: Profile;
	findings: Finding[];
	undecided: string[];
	failed: { check: string; message: string }[];
	placeholders: number;
	ms: number;
}

export interface Check {
	name: string;
	on: (ctx: Ctx) => boolean;
	run: (ctx: Ctx) => Finding[];
}

const isContract = (c: Ctx) => c.profile === "contract" && c.rules.checks.contract;
const idsOn = (c: Ctx) => c.rules.checks.ids;

export const CHECKS: Check[] = [
	{ name: "閉じていないコードブロック", on: () => true, run: ({ doc }) =>
		doc.unclosedAt === null ? [] : [finding("unclosed_fence", "コードブロックが閉じていない(この行より後の節は判定していない)", doc.unclosedAt)] },
	{ name: "H1", on: isContract, run: contract.checkTitle },
	{ name: "節", on: isContract, run: contract.checkSections },
	{ name: "小見出し", on: isContract, run: contract.checkSubheadings },
	{ name: "撤退の小節", on: isContract, run: contract.checkRetreat },
	{ name: "§0 の項目", on: isContract, run: contract.checkZeroPhrases },
	{ name: "欄の節への言及", on: isContract, run: contract.checkMention },
	{ name: "名前の行", on: isContract, run: contract.checkTentative },
	{ name: "欄の数", on: isContract, run: contract.checkPlaceholder },
	{ name: "優先度", on: isContract, run: contract.checkPriority },
	{ name: "絵文字", on: (c) => c.profile === "contract" && c.rules.checks.emoji, run: checkEmoji },
	{ name: "重複定義", on: idsOn, run: ids.checkDuplicates },
	{ name: "番号の抜け", on: idsOn, run: ids.checkGaps },
	{ name: "参照", on: idsOn, run: ids.checkRefs },
	{ name: "未知の接頭辞", on: (c) => c.rules.checks.unknownPrefix, run: ids.checkUnknownPrefixes },
];

export interface CheckInput {
	path: string;
	text: string;
	/** vault のフォルダのパス(getAllFolders) */
	folders: string[];
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function runChecks(input: CheckInput, rules: Rules, checks: Check[] = CHECKS): CheckResult {
	const t0 = performance.now();
	const failed: CheckResult["failed"] = [];
	const findings: Finding[] = [];
	const doc = scanLines(input.path, input.text);
	let scan: DefScan | null = null;
	const ctx: Ctx = {
		doc, rules, folders: input.folders, undecided: [], profile: profileOf(doc, rules),
		defs: () => (scan ??= ids.scanDefs(doc, rules)),
	};
	for (const c of checks) {
		try {
			if (c.on(ctx)) findings.push(...c.run(ctx));
		} catch (e) {
			failed.push({ check: c.name, message: message(e) });
		}
	}
	let placeholders = 0;
	if (ctx.profile === "contract") {
		try {
			placeholders = contract.countPlaceholders(doc, rules);
		} catch (e) {
			failed.push({ check: "欄の数", message: message(e) });
		}
	}
	const order = (f: Finding) => KINDS.indexOf(f.kind) * 1e7 + (f.line ?? 1e7 - 1);
	findings.sort((a, b) => order(a) - order(b));
	return {
		path: input.path, profile: ctx.profile, findings, undecided: [...new Set(ctx.undecided)], failed, placeholders,
		ms: Math.round(performance.now() - t0),
	};
}
