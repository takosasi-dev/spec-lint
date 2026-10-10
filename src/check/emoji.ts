// 絵文字の検査(FR-18。契約型): 規則ノートの形に当たり allow に無い文字を、行と文字の番号(U+XXXX)で出す。
// 純関数。obsidian を import しない。形は規則ノートの値だけを使う(INV-5・D-14)。全部の行(コードブロックの中も)を見る。
import { finding, type Ctx, type Finding } from "./finding";

/** "U+1F552" の形。異体字セレクタ(U+FE0F)は除く */
export const codeLabel = (s: string): string =>
	[...s].filter((ch) => ch !== "️")
		.map((ch) => "U+" + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")).join(" ");

export function checkEmoji({ doc, rules }: Ctx): Finding[] {
	const allow = rules.contract.emoji.allow;
	const out: Finding[] = [];
	doc.lines.forEach((l, line) => {
		for (const m of l.text.matchAll(rules.re.emoji)) {
			const s = m[0];
			const code = codeLabel(s);
			// allow は文字そのもの・U+FE0F を除いた文字・"U+1F552" の形のどれでも書ける
			if (allow.includes(s) || allow.includes(s.replace(/️/g, "")) || allow.includes(code)) continue;
			out.push(finding("emoji", `${code}(${s})`, line));
		}
	});
	return out;
}
