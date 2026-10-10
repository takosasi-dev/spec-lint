// 規則ノートの本文から ```json のブロックをちょうど1つ取り出す(§9.2・FR-2)。純関数。obsidian を import しない。
// 0個・2個以上・閉じていないときは理由を返す。ブロックの外の地の文(出典の説明)は読まない(D-7)。
export interface RulesError {
	reason: string;
	/** 形が違う項目・作れない正規表現の項目の名前 */
	item?: string;
}

const OPEN = /^\s*```json\s*$/;
const CLOSE = /^\s*```\s*$/;

export function extractJson(note: string): { json: string } | RulesError {
	const lines = note.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
	const blocks: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (!OPEN.test(lines[i] ?? "")) continue;
		const start = i + 1;
		let end = start;
		while (end < lines.length && !CLOSE.test(lines[end] ?? "")) end++;
		if (end >= lines.length) return { reason: "json のブロックが閉じていない" };
		blocks.push(lines.slice(start, end).join("\n"));
		i = end;
	}
	if (blocks.length === 0) return { reason: "json のブロックが無い" };
	if (blocks.length > 1) return { reason: `json のブロックが ${blocks.length} 個ある(1個だけにする)` };
	return { json: blocks[0] ?? "" };
}
