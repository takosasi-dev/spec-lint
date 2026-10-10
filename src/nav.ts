// 指摘の行へ移る(FR-20・D-13): その仕様書を出している MarkdownView の editor で setCursor と scrollIntoView。
// 出していなければ getLeaf(false).openFile で開いてから。分割で2つあれば getLeavesOfType("markdown") の順で最初の物(§10)。
// 行がずれていても移動はそのまま行う(§10)。Notice は出さない(INV-12)。
import { MarkdownView, type App } from "obsidian";
import { fileAt } from "./source";

function shownIn(app: App, path: string): MarkdownView | null {
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) return leaf.view;
	}
	return null;
}

export async function openAt(app: App, path: string, line: number): Promise<void> {
	let view = shownIn(app, path);
	if (!view) {
		const file = fileAt(app, path);
		if (!file) return;
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
		if (!(leaf.view instanceof MarkdownView)) return;
		view = leaf.view;
	}
	await app.workspace.revealLeaf(view.leaf);
	app.workspace.setActiveLeaf(view.leaf, { focus: true });
	const editor = view.editor;
	const pos = { line: Math.max(0, Math.min(line, editor.lineCount() - 1)), ch: 0 };
	editor.setCursor(pos);
	editor.scrollIntoView({ from: pos, to: pos }, true);
}
