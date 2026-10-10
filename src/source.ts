// Obsidian の Vault と Workspace から読むのはこのファイルだけ(§2・INV-4)。本文は cachedRead だけで読む。
// 読む本文は、開いている仕様書1本と規則ノート1本だけ。書き込み系のメソッドは呼ばない(INV-1)。
import type { App, TFile } from "obsidian";

export const activeFile = (app: App): TFile | null => app.workspace.getActiveFile();

export const fileAt = (app: App, path: string): TFile | null => app.vault.getFileByPath(path);

/** 規則ノートの本文。無ければ null(FR-2) */
export async function readRulesNote(app: App, path: string): Promise<string | null> {
	const file = path === "" ? null : fileAt(app, path);
	return file ? app.vault.cachedRead(file) : null;
}

export const readSpec = (app: App, file: TFile): Promise<string> => app.vault.cachedRead(file);

/** vault のフォルダのパス(プロダクト名の材料。D-8) */
export const folderPaths = (app: App): string[] => app.vault.getAllFolders().map((f) => f.path);
