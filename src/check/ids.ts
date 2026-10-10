// 番号の検査(FR-14〜FR-17。両方の型): 定義の読み取り・重複定義・番号の抜け・定義の無い参照・未知の接頭辞。
// 純関数。obsidian を import しない。定義の形・接頭辞・下限・除く名前は規則ノートから読む(INV-5)。コードブロックの中も数える。
// 定義の無い参照は「切れ」と断定せず、同じ行にプロダクト名があれば除いた参照、無ければ見つからない参照にする(D-8・INV-7)。
import type { Rules } from "../rules/validate";
import { finding, type Ctx, type Def, type DefScan, type Finding } from "./finding";
import type { Doc } from "./lines";

/** 各行に definePatterns を順に当て、最初に当たった物を定義にする(§9.6) */
export function scanDefs(doc: Doc, rules: Rules): DefScan {
	const defs: Def[] = [];
	const unknown: Def[] = [];
	doc.lines.forEach((l, line) => {
		for (const re of rules.re.define) {
			const m = re.exec(l.text);
			if (!m) continue;
			const [, prefix = "", no = "", branch = ""] = m;
			const d: Def = { prefix, no: Number(no), branch, raw: `${prefix}-${no}${branch}`, line };
			(rules.ids.prefixes.includes(prefix) ? defs : unknown).push(d);
			return;
		}
	});
	return { defs, unknown };
}

export function checkDuplicates(ctx: Ctx): Finding[] {
	const by = new Map<string, Def[]>();
	for (const d of ctx.defs().defs) {
		const key = `${d.prefix}-${d.no}${d.branch}`;
		by.set(key, [...(by.get(key) ?? []), d]);
	}
	return [...by.values()].filter((ds) => ds.length > 1)
		.flatMap((ds) => ds.map((d) => finding("duplicate_def", `${d.raw}(${ds.length} 回定義)`, d.line, { count: ds.length })));
}

/** 接頭辞ごとに枝番を除いた番号を集め、gapMinDefinitions 以上なら 1 から最大までの抜けを出す。続く抜けは1つにまとめる */
export function checkGaps(ctx: Ctx): Finding[] {
	const by = new Map<string, Map<number, Def>>();
	for (const d of ctx.defs().defs) {
		const m = by.get(d.prefix) ?? new Map<number, Def>();
		if (!m.has(d.no)) m.set(d.no, d);
		by.set(d.prefix, m);
	}
	const out: Finding[] = [];
	for (const [p, m] of by) {
		if (m.size < ctx.rules.ids.gapMinDefinitions) continue;
		const max = Math.max(...m.keys());
		for (let n = 1; n <= max; n++) {
			if (m.has(n)) continue;
			let end = n;
			while (end + 1 <= max && !m.has(end + 1)) end++;
			const range = end === n ? `${p}-${n}` : `${p}-${n}〜${p}-${end}`;
			// 行は抜けの直前の番号の定義の行。直前が無い(1 から抜けている)ときは直後の番号の行
			const anchor = m.get(n - 1) ?? m.get(end + 1);
			out.push(finding("numbering_gap", anchor ? `${range}(${anchor.raw} の行)` : range, anchor?.line));
			n = end;
		}
	}
	return out;
}

/** 仕様書フォルダの下のフォルダの名前から、OS の分類名などと自分の名前を除いた物(D-8) */
export function productNames(folders: string[], specPath: string, rules: Rules): string[] {
	const parts = specPath.split("/");
	const parent = parts[parts.length - 2] ?? "";
	const own = (parts[parts.length - 1] ?? "").replace(/\.md$/, "").split("_")[0] ?? "";
	const skip = new Set([...rules.ids.productNameIgnore, parent, own]);
	const names = folders
		.filter((f) => rules.targets.specFolders.some((s) => f.startsWith(s + "/")))
		.map((f) => f.slice(f.lastIndexOf("/") + 1))
		.filter((n) => n !== "" && !skip.has(n));
	return [...new Set(names)];
}

export function checkRefs(ctx: Ctx): Finding[] {
	const re = ctx.rules.re.ref;
	if (!re) return [];
	const defined = new Set(ctx.defs().defs.map((d) => `${d.prefix}-${d.no}`));
	// 長い名前を先に見る(短い名前が長い名前の一部のとき、長い方を名前として出す)
	const names = productNames(ctx.folders, ctx.doc.path, ctx.rules).sort((a, b) => b.length - a.length);
	const out: Finding[] = [];
	ctx.doc.lines.forEach((l, line) => {
		for (const m of l.text.matchAll(re)) {
			const [, , p = "", no = "", branch = ""] = m;
			if (defined.has(`${p}-${Number(no)}`)) continue;     // 枝番つきでも無しでも定義があれば何もしない
			const raw = `${p}-${no}${branch}`;
			const name = names.find((n) => l.text.includes(n));
			out.push(name === undefined ? finding("undefined_ref", raw, line) : finding("excluded_ref", raw, line, { productName: name }));
		}
	});
	return out;
}

/** prefixes に無い接頭辞を、接頭辞ごとに1件、最初の行と件数で出す(FR-17) */
export function checkUnknownPrefixes(ctx: Ctx): Finding[] {
	const by = new Map<string, Def[]>();
	for (const d of ctx.defs().unknown) by.set(d.prefix, [...(by.get(d.prefix) ?? []), d]);
	return [...by].map(([p, ds]) => finding("unknown_prefix", `${p}(${ds.length} 件。最初は ${ds[0]?.raw ?? ""})`, ds[0]?.line, { count: ds.length }));
}
