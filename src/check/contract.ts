// 契約型の検査(FR-5〜FR-13): H1・節の有無と順番・見出しの文言・余分な H2・小見出し・撤退の小節・§0・言及・名前の行・欄・優先度。
// 純関数。obsidian を import しない。比べる文字・語・節の番号は規則ノートの値だけを使い(INV-5)、画面の文もその値を差し込む。
// 閉じていないコードブロックにかかる節は検査せず undecided に入れる(D-12・INV-6)。
import type { Rules } from "../rules/validate";
import { finding, type Ctx, type Finding } from "./finding";
import { normalizeHeading, sectionBody, sectionRanges, sectionUndecided, type Doc } from "./lines";

const leadingNo = (h: string): string => String(Number(/^\d+/.exec(h)?.[0] ?? "NaN"));

/** 節 no を検査してよいか。無ければ false(節の検査が出す)、コードブロックにかかれば undecided に足して false */
function decidable(ctx: Ctx, no: string, what: string): boolean {
	if (sectionUndecided(ctx.doc, no)) {
		ctx.undecided.push(`§${no} の${what}`);
		return false;
	}
	return sectionRanges(ctx.doc, no).length > 0;
}

const firstLine = (doc: Doc, no: string): number | undefined => sectionRanges(doc, no)[0]?.start;

export function checkTitle({ doc, rules, undecided }: Ctx): Finding[] {
	const i = doc.lines.findIndex((l) => l.level === 1 && l.text.startsWith("# "));
	if (i < 0) {
		if (doc.unclosedAt !== null) undecided.push("H1");
		return doc.unclosedAt !== null ? [] : [finding("missing_title", "H1 が無い")];
	}
	const text = doc.lines[i]?.text ?? "";
	return rules.re.title.test(text) ? [] : [finding("missing_title", `H1 が形に合わない: ${text}`, i)];
}

export function checkSections(ctx: Ctx): Finding[] {
	const { doc, rules } = ctx;
	const out: Finding[] = [];
	const headings = rules.contract.headings;
	const nos = headings.map(leadingNo);
	headings.forEach((h, idx) => {
		const no = nos[idx] ?? "";
		const hs = doc.h2s.filter((x) => x.no === no);
		if (hs.length === 0) {
			if (doc.unclosedAt !== null) ctx.undecided.push(`§${no} の節`);
			else out.push(finding("missing_section", `§${no}「${h}」が無い`));
			return;
		}
		if (hs.length > 1) for (const x of hs) out.push(finding("duplicate_section", `§${no} が ${hs.length} 個ある: ${x.title}`, x.line, { count: hs.length }));
		if (/^\d+\.?$/.test(h.trim())) return;          // 番号だけの要素は文言を比べない(FR-6)
		for (const x of hs) {
			if (normalizeHeading(x.title) !== normalizeHeading(h)) out.push(finding("heading_text", `「${x.title}」(規則は「${h}」)`, x.line));
		}
	});
	const last = Math.max(...nos.map(Number));
	let prev: number | null = null;
	for (const x of doc.h2s) {
		if (x.no === null || Number(x.no) > last) out.push(finding("extra_h2", x.title, x.line));
		if (x.no === null) continue;
		const n = Number(x.no);
		if (prev !== null && n < prev) out.push(finding("section_order", `§${n} が §${prev} の後にある`, x.line));
		prev = n;
	}
	return out;
}

/** 節 no の H3(行と文字列) */
function h3s(doc: Doc, no: string): { line: number; title: string }[] {
	const out: { line: number; title: string }[] = [];
	for (const r of sectionRanges(doc, no)) {
		for (let i = r.start + 1; i < r.end; i++) {
			const l = doc.lines[i];
			if (l && l.level === 3) out.push({ line: i, title: l.title });
		}
	}
	return out;
}

export function checkSubheadings(ctx: Ctx): Finding[] {
	const out: Finding[] = [];
	for (const [no, words] of Object.entries(ctx.rules.contract.subheadings)) {
		if (!decidable(ctx, no, "小見出し")) continue;
		const titles = h3s(ctx.doc, no).map((h) => h.title);
		for (const w of words) {
			if (!titles.some((t) => t.startsWith(w))) {
				out.push(finding("missing_subheading", `§${no} に「${w}」で始まる小見出しが無い`, firstLine(ctx.doc, no)));
			}
		}
	}
	return out;
}

/** 行が definePatterns のどれかに当たれば、最初に当たった式の接頭辞(§9.6) */
export function definedPrefix(text: string, rules: Rules): string | null {
	for (const re of rules.re.define) {
		const m = re.exec(text);
		if (m) return m[1] ?? "";
	}
	return null;
}

export function checkRetreat(ctx: Ctx): Finding[] {
	const { doc, rules } = ctx;
	const r = rules.contract.retreat;
	const no = String(r.section);
	if (!decidable(ctx, no, `小節「${r.subheading}」`)) return [];
	const out: Finding[] = [];
	for (const h of h3s(doc, no).filter((x) => x.title.startsWith(r.subheading))) {
		let found = false;
		for (let i = h.line + 1; i < doc.lines.length; i++) {
			const l = doc.lines[i];
			if (!l || l.level === 2 || l.level === 3) break;
			if (definedPrefix(l.text, rules) === r.prefix) {
				found = true;
				break;
			}
		}
		if (!found) out.push(finding("retreat_empty", `§${no}「${h.title}」に ${r.prefix} の定義が無い`, h.line));
	}
	return out;
}

const bodyText = (doc: Doc, no: string) => sectionBody(doc, no).map((l) => l.text).join("\n");

export function checkZeroPhrases(ctx: Ctx): Finding[] {
	if (!decidable(ctx, "0", "項目")) return [];
	const text = bodyText(ctx.doc, "0");
	return ctx.rules.contract.zeroPhrases
		.filter((z) => !z.any.some((a) => text.includes(a)))
		.map((z) => finding("zero_phrase", `§0 に「${z.name}」が無い`, firstLine(ctx.doc, "0")));
}

export function checkMention(ctx: Ctx): Finding[] {
	const c = ctx.rules.contract;
	const out: Finding[] = [];
	for (const n of c.section8MentionIn) {
		const no = String(n);
		if (!decidable(ctx, no, `「${c.section8Mention}」の言及`)) continue;
		if (!bodyText(ctx.doc, no).includes(c.section8Mention)) {
			out.push(finding("no_s8_mention", `§${no} に「${c.section8Mention}」が無い`, firstLine(ctx.doc, no)));
		}
	}
	return out;
}

export function checkTentative(ctx: Ctx): Finding[] {
	const t = ctx.rules.contract.tentativeName;
	const no = String(t.section);
	if (!decidable(ctx, no, `「${t.word}」の行`)) return [];
	return sectionBody(ctx.doc, no).some((l) => l.text.includes(t.word)) ? [] : [finding("no_tentative", `§${no} に「${t.word}」を含む行が無い`)];
}

/** §8(section8Mention の数字の節)の本文の欄の数。節が無ければ 0(FR-12) */
export function countPlaceholders(doc: Doc, rules: Rules): number {
	return bodyText(doc, rules.placeholderSection).match(rules.re.placeholder)?.length ?? 0;
}

export function checkPlaceholder(ctx: Ctx): Finding[] {
	const no = ctx.rules.placeholderSection;
	if (!decidable(ctx, no, "欄")) return [];
	return countPlaceholders(ctx.doc, ctx.rules) === 0 ? [finding("no_placeholder", `§${no} の欄が 0 個`, firstLine(ctx.doc, no))] : [];
}

export function checkPriority({ doc, rules }: Ctx): Finding[] {
	const re = rules.re.define[0];
	const p = rules.contract.priority;
	if (!re) return [];
	const out: Finding[] = [];
	doc.lines.forEach((l, i) => {
		const m = re.exec(l.text);
		if (!m || m[1] !== p.prefix) return;
		const cells = l.text.split("|").map((c) => c.trim()).filter((c) => c !== "");
		const last = cells[cells.length - 1] ?? "";
		if (!p.words.some((w) => last.includes(w))) out.push(finding("missing_priority", `${m[1]}-${m[2] ?? ""}${m[3] ?? ""}`, i));
	});
	return out;
}
