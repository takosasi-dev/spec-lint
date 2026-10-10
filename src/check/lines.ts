// 本文を行に分け、コードブロックの内外・見出し・H2 の節を1回の読みで決める(§9.6「行と節」・D-11)。
// 純関数。obsidian を import しない。BlockerBoard と同じ規則で書いたが、コードは共有しない(D-11)。
// 閉じていないコードブロックは、開いた行を覚える(FR-3・D-12)。
export interface Line {
	text: string;
	/** フェンスの行か、コードブロックの中 */
	code: boolean;
	/** 見出しの深さ。見出しでなければ 0 */
	level: number;
	/** 見出しの文字列(見出しでなければ "") */
	title: string;
	/** 属する H2 の節番号(H2 の文字列の先頭の数字)。最初の H2 より前と、数字で始まらない H2 の下は null */
	section: string | null;
}

export interface H2 {
	line: number;
	title: string;
	/** 先頭の数字。無ければ null */
	no: string | null;
}

export interface Doc {
	path: string;
	lines: Line[];
	h2s: H2[];
	/** 閉じていないコードブロックを開いた行。閉じていれば null */
	unclosedAt: number | null;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const SECTION_NO = /^\d+/;

export function scanLines(path: string, text: string): Doc {
	let code = false;
	let openedAt = -1;
	let section: string | null = null;
	const h2s: H2[] = [];
	const lines = text.split("\n").map((raw, i): Line => {
		const t = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
		if (FENCE.test(t)) {
			code = !code;
			if (code) openedAt = i;
			return { text: t, code: true, level: 0, title: "", section };
		}
		const h = code ? null : HEADING.exec(t);
		if (!h) return { text: t, code, level: 0, title: "", section };
		const level = (h[1] ?? "").length;
		const title = h[2] ?? "";
		if (level === 2) {
			const m = SECTION_NO.exec(title);
			section = m ? String(Number(m[0])) : null;   // "08" と "8" は同じ節
			h2s.push({ line: i, title, no: section });
		}
		return { text: t, code: false, level, title, section };
	});
	return { path, lines, h2s, unclosedAt: code ? openedAt : null };
}

/** 節番号 no の範囲(H2 の行から次の H2 の前まで)。同じ番号の H2 が2つあれば両方(§10) */
export function sectionRanges(doc: Doc, no: string): { start: number; end: number }[] {
	const out: { start: number; end: number }[] = [];
	doc.h2s.forEach((h, i) => {
		if (h.no === no) out.push({ start: h.line, end: doc.h2s[i + 1]?.line ?? doc.lines.length });
	});
	return out;
}

/** 節の本文の行(H2 の行を除く。コードブロックの中も含む) */
export function sectionBody(doc: Doc, no: string): { line: number; text: string }[] {
	const out: { line: number; text: string }[] = [];
	for (const r of sectionRanges(doc, no)) {
		for (let i = r.start + 1; i < r.end; i++) out.push({ line: i, text: doc.lines[i]?.text ?? "" });
	}
	return out;
}

/** 節が閉じていないコードブロックにかかっていて、終わりが分からない(D-12) */
export function sectionUndecided(doc: Doc, no: string): boolean {
	if (doc.unclosedAt === null) return false;
	const cut = doc.unclosedAt;
	const ranges = sectionRanges(doc, no);
	return ranges.length === 0 || ranges.some((r) => r.end > cut);
}

/** 比べる前の置き換え: 全角の括弧を半角に、続く空白を1つに(FR-6) */
export const normalizeHeading = (s: string): string =>
	s.replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, " ").trim();

/** path が base そのものか、その下にあるか */
export const inFolder = (path: string, base: string): boolean => path === base || path.startsWith(base + "/");
