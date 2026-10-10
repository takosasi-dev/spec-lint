// 開いているファイルが検査の対象か(FR-1)と、仕様書の型(契約型 / 汎用型。FR-4・D-6)を決める。
// 純関数。obsidian を import しない。比べる文字は規則ノートの値だけを使う(INV-5)。
import type { Rules } from "../rules/validate";
import { inFolder, normalizeHeading, type Doc } from "./lines";

export type Profile = "contract" | "generic";

/** targets.specFolders の下の md で、excludePaths の下でも規則ノート自身でもない(FR-1) */
export function isTarget(path: string, extension: string, rules: Rules, rulesNotePath: string): boolean {
	if (extension !== "md" || path === rulesNotePath) return false;
	if (!rules.targets.specFolders.some((f) => path.startsWith(f + "/"))) return false;
	return !rules.targets.excludePaths.some((e) => inFolder(path, e));
}

/** H2 のどれかが detectHeading と同じ(置き換えの後)で、contract.excludePaths の下でなければ契約型(§9.6) */
export function profileOf(doc: Doc, rules: Rules): Profile {
	if (rules.contract.excludePaths.some((e) => inFolder(doc.path, e))) return "generic";
	const want = normalizeHeading(rules.contract.detectHeading);
	return doc.h2s.some((h) => normalizeHeading(h.title) === want) ? "contract" : "generic";
}
